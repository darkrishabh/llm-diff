import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BenchmarkJson, GradingJson, RunMode } from "./types.js";
import { assertInside, ensureDir, writeFileInside } from "./fs-utils.js";

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
  outputFiles: { path: string; content: string | Buffer }[] = []
): void {
  const outputDir = path.join(runDir, "outputs");
  ensureDir(outputDir);
  writeFileSync(path.join(runDir, "timing.json"), `${JSON.stringify(timing, null, 2)}\n`, "utf-8");
  writeFileSync(path.join(runDir, "grading.json"), `${JSON.stringify(grading, null, 2)}\n`, "utf-8");
  writeFileSync(path.join(outputDir, "response.txt"), rawOutput, "utf-8");
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
