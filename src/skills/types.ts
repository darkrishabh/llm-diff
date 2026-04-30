import type { Provider } from "../engine/providers/base.js";

export interface AttachedFile {
  path: string;
  content: string;
  kind: "text" | "binary-skipped" | "missing" | "too-large";
  bytes?: number;
}

export interface AgentSkillsEval {
  id?: number | string;
  name?: string;
  prompt: string;
  expected_output?: string;
  files?: string[];
  assertions?: string[];
}

export interface Skill {
  name: string;
  description?: string;
  dir: string;
  skillMd: string;
  references: AttachedFile[];
  scripts: AttachedFile[];
  evals: AgentSkillsEval[];
  evalFilesDir?: string;
}

export type RunMode = "with_skill" | "without_skill";

export interface SkillModelTarget {
  model: string;
  provider: Provider;
}

export interface AssertionResult {
  text: string;
  passed: boolean;
  evidence: string;
}

export interface GradingJson {
  assertion_results: AssertionResult[];
  summary: { passed: number; failed: number; total: number; pass_rate: number };
}

export interface AggStats {
  pass_rate: { mean: number; stddev: number };
  time_seconds: { mean: number; stddev: number };
  tokens: { mean: number; stddev: number };
}

export interface BenchmarkJson {
  run_summary: {
    with_skill: AggStats;
    without_skill?: AggStats;
    delta?: { pass_rate: number; time_seconds: number; tokens: number };
  };
}

// ─── progress events ──────────────────────────────────────────────────────────
// Emitted by evaluateSkills / runEval as a typed event stream so callers can
// build their own UI. The bundled `consoleReporter` is the default consumer.

export interface SuiteStartEvent {
  type: "suite-start";
  skill: string;
  relPath: string;
  evalsCount: number;
  modes: RunMode[];
  target: string;
  judge: string;
}

export interface EvalStartEvent {
  type: "eval-start";
  skill: string;
  evalIndex: number;
  evalSlug: string;
  evalName?: string;
  evalId?: number | string;
  mode: RunMode;
  /** System message sent to the target model (only set in `with_skill` mode). */
  system?: string;
  /** User message sent to the target model. */
  user: string;
  /** Number of `evals[].files` attached / inlined for this run. */
  fileCount: number;
}

export interface EvalEndEvent {
  type: "eval-end";
  skill: string;
  evalIndex: number;
  evalSlug: string;
  evalName?: string;
  evalId?: number | string;
  mode: RunMode;
  /** Raw text returned by the target model. */
  output: string;
  timing: { total_tokens: number; duration_ms: number };
  grading: GradingJson;
  /** The prompt sent to the judge model for grading (useful for debugging). */
  judgePrompt?: string;
}

export interface SuiteEndEvent {
  type: "suite-end";
  skill: string;
  benchmarkPath: string;
  benchmark: BenchmarkJson;
}

export type SkillsEvent =
  | SuiteStartEvent
  | EvalStartEvent
  | EvalEndEvent
  | SuiteEndEvent;
