import { evaluateSkills } from "../skills/index.js";
import { OpenAICompatibleProvider } from "../engine/index.js";
import type { Command } from "commander";

export interface SkillsCommandOptions {
  workspace?: string;
  baseline?: boolean;
  target?: string;
  judge?: string;
  baseUrl?: string;
  apiKeyEnv?: string;
  include?: string[];
  exclude?: string[];
}

export async function runSkillsCommand(root: string, opts: SkillsCommandOptions): Promise<void> {
  const apiKeyEnv = opts.apiKeyEnv ?? "OPENAI_API_KEY";
  const apiKey = process.env[apiKeyEnv];
  const baseUrl = opts.baseUrl ?? process.env.OPENAI_BASE_URL;
  const targetModel = opts.target ?? "gpt-4o-mini";
  const judgeModel = opts.judge ?? targetModel;

  if (!baseUrl) {
    process.stderr.write("error: provide --base-url or set OPENAI_BASE_URL\n");
    process.exitCode = 1;
    return;
  }
  if (!apiKey) {
    process.stderr.write(`error: environment variable ${apiKeyEnv} is not set\n`);
    process.exitCode = 1;
    return;
  }

  const targetProvider = new OpenAICompatibleProvider({
    providerName: "openai-compatible",
    baseUrl,
    apiKey,
    model: targetModel,
  });
  const judgeProvider = new OpenAICompatibleProvider({
    providerName: "openai-compatible",
    baseUrl,
    apiKey,
    model: judgeModel,
  });

  const result = await evaluateSkills({
    root,
    workspace: opts.workspace ?? "./bench-workspace",
    baseline: opts.baseline ?? false,
    target: { model: targetModel, provider: targetProvider },
    judge: { model: judgeModel, provider: judgeProvider },
    include: opts.include,
    exclude: opts.exclude,
    onLog: (line) => process.stderr.write(`${line}\n`),
  });

  process.stdout.write(
    JSON.stringify(
      {
        passed: result.passed,
        failed: result.failed,
        skills: result.skills,
        historyIteration: result.historyIteration,
        reportPath: result.reportPath,
      },
      null,
      2
    ) + "\n"
  );

  process.exitCode = result.failed > 0 ? 1 : 0;
}

export function registerSkillsCommand(program: Command): void {
  program
    .command("skills <root>")
    .description("Evaluate agentskills.io skills and write the standard workspace artifacts")
    .option("--workspace <path>", "Workspace directory for iteration artifacts", "./bench-workspace")
    .option("--baseline", "Run with_skill and without_skill modes", false)
    .option("--target <model>", "Target model name", "gpt-4o-mini")
    .option("--judge <model>", "Judge model name")
    .option("--base-url <url>", "OpenAI-compatible API base URL")
    .option("--api-key-env <name>", "API key environment variable name", "OPENAI_API_KEY")
    .option("--include <glob>", "Include skill relPath glob", (value, previous: string[] = []) => [...previous, value], [])
    .option("--exclude <glob>", "Exclude skill relPath glob", (value, previous: string[] = []) => [...previous, value], [])
    .option("--no-color", "Disable color output")
    .action((root: string, opts: SkillsCommandOptions) => {
      void runSkillsCommand(root, opts);
    });
}
