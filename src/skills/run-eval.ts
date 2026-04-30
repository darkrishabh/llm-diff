import path from "node:path";
import type { Provider } from "../engine/providers/base.js";
import type { ProviderResult } from "../engine/types.js";
import { writeRunArtifacts } from "./artifacts.js";
import { gradeOutputs, type GradingJson } from "./grade.js";
import type { AgentSkillsEval, AttachedFile, Skill } from "./types.js";
import { attachedFileXml, readAttachedFile, slugify } from "./fs-utils.js";

export type RunMode = "with_skill" | "without_skill";

export interface RunEvalArgs {
  skill: Skill;
  eval: AgentSkillsEval;
  modes: RunMode[];
  target: { model: string; provider: Provider };
  judge: { model: string; provider: Provider };
  workspace: string;
  iteration: number;
  gradingPrompt?: string;
  index?: number;
  evalRootDir?: string;
}

export interface RunEvalResult {
  slug: string;
  modes: Record<RunMode, {
    outputDir: string;
    timing: { total_tokens: number; duration_ms: number };
    grading: GradingJson;
    rawOutput: string;
  }>;
}

function evalSlug(evalCase: AgentSkillsEval, index = 0): string {
  const source = evalCase.name ?? (evalCase.id !== undefined ? `eval-${String(evalCase.id)}` : `eval-${index + 1}`);
  const slug = slugify(source, `eval-${index + 1}`);
  return slug.startsWith("eval-") ? slug : `eval-${slug}`;
}

function renderSkillSystemMessage(skill: Skill): string {
  const parts = [
    `<skill name="${skill.name}">`,
    `<description>${skill.description ?? ""}</description>`,
    `<instructions>`,
    skill.skillMd,
    `</instructions>`,
  ];

  if (skill.references.length > 0) {
    parts.push(`<references>`);
    for (const ref of skill.references) parts.push(attachedFileXml("reference", ref));
    parts.push(`</references>`);
  }

  if (skill.scripts.length > 0) {
    parts.push(`<scripts>`);
    for (const script of skill.scripts) parts.push(attachedFileXml("script", script));
    parts.push(`</scripts>`);
  }

  parts.push(`</skill>`);
  return parts.join("\n");
}

function readEvalFiles(skill: Skill, evalCase: AgentSkillsEval): AttachedFile[] {
  return (evalCase.files ?? []).map((relativePath) =>
    readAttachedFile(skill.dir, relativePath)
  );
}

function inlineFiles(user: string, files: AttachedFile[]): string {
  if (files.length === 0) return user;
  return [
    ...files.map((file) => attachedFileXml("file", file)),
    "---USER PROMPT---",
    user,
  ].join("\n\n");
}

async function completeWithFallback(args: {
  provider: Provider;
  system?: string;
  user: string;
  attachments: AttachedFile[];
}): Promise<ProviderResult> {
  const { provider, system } = args;
  let user = args.user;
  let attachments: AttachedFile[] | undefined;

  if (provider.capabilities?.attachments) {
    attachments = args.attachments;
  } else {
    user = inlineFiles(user, args.attachments);
  }

  if (provider.completeChat && provider.capabilities?.systemRole) {
    return provider.completeChat({ system, user, attachments });
  }

  const merged = [system, "", "---USER REQUEST---", user].filter(Boolean).join("\n");
  return provider.complete(merged);
}

function timingFrom(result: ProviderResult): { total_tokens: number; duration_ms: number } {
  return {
    total_tokens: (result.inputTokens ?? 0) + (result.outputTokens ?? 0),
    duration_ms: result.latencyMs ?? 0,
  };
}

export async function runEval(args: RunEvalArgs): Promise<RunEvalResult> {
  if (args.modes.length === 0) throw new Error("runEval requires at least one mode");

  const slug = evalSlug(args.eval, args.index);
  const evalDir = path.join(args.evalRootDir ?? path.join(args.workspace, `iteration-${args.iteration}`), slug);
  const result: RunEvalResult = { slug, modes: {} as RunEvalResult["modes"] };

  for (const mode of args.modes) {
    const runDir = path.join(evalDir, mode);
    const outputDir = path.join(runDir, "outputs");
    const evalFiles = mode === "with_skill" ? readEvalFiles(args.skill, args.eval) : [];
    const system = mode === "with_skill" ? renderSkillSystemMessage(args.skill) : undefined;
    const completion = await completeWithFallback({
      provider: args.target.provider,
      system,
      user: args.eval.prompt,
      attachments: evalFiles,
    });
    const rawOutput = completion.error ? `ERROR: ${completion.error}` : completion.output;
    const assertions = args.eval.assertions ?? [];
    const grading = await gradeOutputs({
      modelOutput: rawOutput,
      assertions,
      judge: args.judge,
      gradingPrompt: args.gradingPrompt,
    });
    const timing = timingFrom(completion);
    writeRunArtifacts(runDir, timing, grading, rawOutput, [
      { path: "output.txt", content: rawOutput },
    ]);

    result.modes[mode] = { outputDir, timing, grading, rawOutput };
  }

  return result;
}
