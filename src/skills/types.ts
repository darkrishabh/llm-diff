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
