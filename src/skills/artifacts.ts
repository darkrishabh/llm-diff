import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  BenchmarkJson,
  GradingJson,
  RunMode,
  ToolCall,
  ToolChoice,
  ToolDef,
} from "./types.js";
import { assertInside, ensureDir, writeFileInside } from "./fs-utils.js";

/**
 * Promptset persisted alongside the spec-mandated grading.json + timing.json.
 * Captures what the model under test and the judge actually saw — essential
 * for debugging and for report rendering.
 */
export interface RunPrompts {
  /** System message sent to the target model (only set in `with_skill`). */
  system?: string;
  /** User message sent to the target model. */
  user: string;
  /** Final prompt sent to the rubric judge for grading. */
  judgePrompt?: string;
  /** Number of attached eval files. */
  fileCount: number;
  /** Function tools sent with the request, if any. */
  tools?: ToolDef[];
  /** Tool selection control sent with the request. */
  tool_choice?: ToolChoice;
}

export interface AggStats {
  pass_rate: { mean: number; stddev: number };
  time_seconds: { mean: number; stddev: number };
  tokens: { mean: number; stddev: number };
}

export interface RunStats {
  mode: RunMode;
  passRate: number;
  durationMs: number;
  tokens: number;
}

export function writeRunArtifacts(
  runDir: string,
  timing: { total_tokens: number; duration_ms: number },
  grading: GradingJson,
  rawOutput: string,
  outputFiles: { path: string; content: string | Buffer }[] = [],
  prompts?: RunPrompts,
  toolCalls?: ToolCall[]
): void {
  const outputDir = path.join(runDir, "outputs");
  ensureDir(outputDir);
  writeFileSync(path.join(runDir, "timing.json"), `${JSON.stringify(timing, null, 2)}\n`, "utf-8");
  writeFileSync(path.join(runDir, "grading.json"), `${JSON.stringify(grading, null, 2)}\n`, "utf-8");
  writeFileSync(path.join(outputDir, "response.txt"), rawOutput, "utf-8");
  if (prompts) {
    writeFileSync(path.join(runDir, "prompts.json"), `${JSON.stringify(prompts, null, 2)}\n`, "utf-8");
  }
  if (toolCalls && toolCalls.length > 0) {
    writeFileSync(
      path.join(runDir, "tool_calls.json"),
      `${JSON.stringify(toolCalls, null, 2)}\n`,
      "utf-8"
    );
  }
  for (const file of outputFiles) {
    writeFileInside(outputDir, file.path, file.content);
  }
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function aggregate(values: RunStats[]): AggStats {
  const passRates = values.map((run) => run.passRate);
  const seconds = values.map((run) => run.durationMs / 1000);
  const tokens = values.map((run) => run.tokens);
  return {
    pass_rate: { mean: round(mean(passRates)), stddev: round(stddev(passRates)) },
    time_seconds: { mean: round(mean(seconds)), stddev: round(stddev(seconds)) },
    tokens: { mean: round(mean(tokens)), stddev: round(stddev(tokens)) },
  };
}

export function buildBenchmark(runs: RunStats[]): BenchmarkJson {
  const withSkill = aggregate(runs.filter((run) => run.mode === "with_skill"));
  const withoutRuns = runs.filter((run) => run.mode === "without_skill");
  const result: BenchmarkJson = {
    run_summary: {
      with_skill: withSkill,
    },
  };
  if (withoutRuns.length > 0) {
    const withoutSkill = aggregate(withoutRuns);
    result.run_summary.without_skill = withoutSkill;
    result.run_summary.delta = {
      pass_rate: round(withSkill.pass_rate.mean - withoutSkill.pass_rate.mean),
      time_seconds: round(withSkill.time_seconds.mean - withoutSkill.time_seconds.mean),
      tokens: round(withSkill.tokens.mean - withoutSkill.tokens.mean),
    };
  }
  return result;
}

export function writeBenchmark(skillIterationDir: string, benchmark: BenchmarkJson): string {
  ensureDir(skillIterationDir);
  const benchmarkPath = path.join(skillIterationDir, "benchmark.json");
  writeFileSync(benchmarkPath, `${JSON.stringify(benchmark, null, 2)}\n`, "utf-8");
  return benchmarkPath;
}

/**
 * Reset and return a per-skill output directory inside the workspace. The
 * returned dir is always empty: prior contents are wiped so the new run is
 * the canonical "current" set of artifacts. This is the default layout —
 * single, current, overwriteable. No iteration numbering.
 */
export function ensureSkillWorkspaceDir(workspace: string, skillSlug: string): string {
  const root = path.resolve(workspace);
  mkdirSync(root, { recursive: true });
  const dir = path.join(root, skillSlug);
  assertInside(root, dir, "skill workspace directory");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Allocate a fresh `<workspace>/.history/iteration-N/` directory for loop-mode
 * snapshotting. N is `max(existing) + 1`, so the directory is monotonically
 * increasing — never overwritten. Used only when `loop: true`.
 */
export function allocateHistoryIteration(workspace: string): { iteration: number; dir: string } {
  const root = path.resolve(workspace);
  const historyRoot = path.join(root, ".history");
  mkdirSync(historyRoot, { recursive: true });
  const highest = readdirSync(historyRoot, { withFileTypes: true }).reduce((max, entry) => {
    if (!entry.isDirectory()) return max;
    const match = entry.name.match(/^iteration-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const iteration = highest + 1;
  const dir = path.join(historyRoot, `iteration-${iteration}`);
  assertInside(historyRoot, dir, "iteration directory");
  mkdirSync(dir, { recursive: true });
  return { iteration, dir };
}

/** Recursively copy a freshly-written skill workspace dir into a history slot. */
export function snapshotSkillToHistory(workspaceSkillDir: string, historyDir: string, skillSlug: string): string {
  const target = path.join(historyDir, skillSlug);
  cpSync(workspaceSkillDir, target, { recursive: true });
  return target;
}

/**
 * @deprecated Replaced by `ensureSkillWorkspaceDir` + `allocateHistoryIteration`.
 * Kept for callers who explicitly want the legacy iteration-N layout.
 */
export function ensureIterationDir(workspace: string): { dir: string; iteration: number } {
  const root = path.resolve(workspace);
  mkdirSync(root, { recursive: true });
  if (process.env.CI === "true") {
    const dir = path.join(root, "iteration-1");
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    return { dir, iteration: 1 };
  }

  const highest = readdirSync(root, { withFileTypes: true }).reduce((max, entry) => {
    if (!entry.isDirectory()) return max;
    const match = entry.name.match(/^iteration-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const iteration = highest + 1;
  const dir = path.join(root, `iteration-${iteration}`);
  assertInside(root, dir, "iteration directory");
  mkdirSync(dir, { recursive: true });
  return { dir, iteration };
}
