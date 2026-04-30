import type { Provider } from "../engine/providers/base.js";
import type { ProviderResult } from "../engine/types.js";
import type { AttachedFile } from "./types.js";

export interface AssertionResult {
  text: string;
  passed: boolean;
  evidence: string;
}

export interface GradingJson {
  assertion_results: AssertionResult[];
  summary: { passed: number; failed: number; total: number; pass_rate: number };
}

export interface GradeOutputsArgs {
  modelOutput: string;
  outputFiles?: AttachedFile[];
  assertions: string[];
  judge: { model: string; provider: Provider };
  gradingPrompt?: string;
}

function truncate(value: string, max = 1200): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function extractJsonObject(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function summarize(grades: AssertionResult[]): GradingJson["summary"] {
  const passed = grades.filter((r) => r.passed).length;
  const total = grades.length;
  const failed = total - passed;
  return { passed, failed, total, pass_rate: total === 0 ? 1 : passed / total };
}

function normalizeGrading(raw: unknown, assertions: string[]): GradingJson {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("grading response must be an object");
  }
  const o = raw as Record<string, unknown>;
  const rawResults = o.assertion_results;
  if (!Array.isArray(rawResults)) {
    throw new Error("grading response missing assertion_results");
  }
  const results: AssertionResult[] = assertions.map((text, index) => {
    const rawResult = rawResults[index] as unknown;
    if (!rawResult || typeof rawResult !== "object" || Array.isArray(rawResult)) {
      return { text, passed: false, evidence: "judge omitted this assertion result" };
    }
    const r = rawResult as Record<string, unknown>;
    return {
      text,
      passed: r.passed === true,
      evidence: typeof r.evidence === "string" && r.evidence.trim()
        ? r.evidence.trim()
        : "judge did not provide concrete evidence",
    };
  });
  return { assertion_results: results, summary: summarize(results) };
}

function failClosed(assertions: string[], response: string): GradingJson {
  const evidence = `judge returned unparseable response: ${truncate(response, 500)}`;
  const assertion_results = assertions.map((text) => ({ text, passed: false, evidence }));
  return { assertion_results, summary: summarize(assertion_results) };
}

function renderPrompt(args: GradeOutputsArgs, previousBadResponse?: string): string {
  if (args.gradingPrompt) {
    return [
      args.gradingPrompt,
      "",
      "Assertions:",
      JSON.stringify(args.assertions, null, 2),
      "",
      "Model output:",
      args.modelOutput,
    ].join("\n");
  }

  const files = (args.outputFiles ?? [])
    .map((file) => `<output_file path="${file.path}" kind="${file.kind}">\n${file.content}\n</output_file>`)
    .join("\n\n") || "No output files were captured.";

  return [
    "You are grading an agentskills.io evaluation run.",
    "",
    "Grading principles:",
    "- Require concrete evidence for every PASS; quote or reference the output.",
    "- Do not give the benefit of the doubt.",
    "- PASS an assertion only if every condition in the assertion text holds.",
    "- A label without substance is a FAIL.",
    "",
    "Return STRICT JSON only. No markdown. Shape:",
    '{"assertion_results":[{"text":"...","passed":true,"evidence":"..."}],"summary":{"passed":0,"failed":0,"total":0,"pass_rate":0}}',
    "",
    "Rules:",
    "- Include every assertion exactly once and copy the full assertion text verbatim into text.",
    "- Use short concrete evidence: quote, snippet, or file reference.",
    "- Summary may be included, but it will be recomputed by the caller.",
    previousBadResponse ? `Previous response was not parseable JSON. Try again. Bad response: ${truncate(previousBadResponse, 500)}` : "",
    "",
    "Assertions:",
    JSON.stringify(args.assertions, null, 2),
    "",
    "Model output:",
    args.modelOutput || "(empty output)",
    "",
    "Output files:",
    files,
  ].filter(Boolean).join("\n");
}

async function callJudge(provider: Provider, prompt: string): Promise<ProviderResult> {
  if (provider.completeChat && provider.capabilities?.systemRole) {
    return provider.completeChat({
      system: "You are a strict JSON-only evaluator.",
      user: prompt,
    });
  }
  return provider.complete(prompt);
}

export async function gradeOutputs(args: GradeOutputsArgs): Promise<GradingJson> {
  if (args.assertions.length === 0) {
    return { assertion_results: [], summary: { passed: 0, failed: 0, total: 0, pass_rate: 1 } };
  }

  let badResponse = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await callJudge(args.judge.provider, renderPrompt(args, badResponse || undefined));
    const text = response.output || response.error || "";
    try {
      return normalizeGrading(JSON.parse(extractJsonObject(text)), args.assertions);
    } catch {
      badResponse = text;
    }
  }

  return failClosed(args.assertions, badResponse);
}
