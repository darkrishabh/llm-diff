/** Built-in provider names. The type is widened to `string` so that
 *  OpenAI-compatible providers (openai, groq, openrouter, etc.) can also
 *  flow through ProviderResult without a cast. */
export type ProviderName = string;

export interface ProviderConfig {
  claude?: {
    apiKey: string;
    model?: string;
  };
  ollama?: {
    baseUrl?: string;
    model?: string;
  };
  minimax?: {
    apiKey: string;
    groupId: string;
    model?: string;
  };
}

// ─── tool calling (OpenAI-compatible passthrough shape) ──────────────────────
// Used by providers that support the OpenAI Chat Completions tool spec.
// All shapes are strict subsets of the upstream schema so they can be sent
// and received without translation.

export interface ToolFunctionDef {
  name: string;
  description?: string;
  /** JSON Schema describing the arguments object. */
  parameters?: Record<string, unknown>;
}

export interface ToolDef {
  type: "function";
  function: ToolFunctionDef;
}

export type ToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } };

export interface ToolCall {
  id?: string;
  type: "function";
  function: { name: string; arguments: string };
  /**
   * `arguments` parsed once by the provider when valid JSON. `undefined`
   * if the model returned malformed JSON; assertions should fall back to
   * the raw `function.arguments` string in that case.
   */
  parsedArguments?: unknown;
}

export interface ProviderResult {
  provider: ProviderName;
  model: string;
  output: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error?: string;
  /** Set when the model emitted structured tool calls. */
  toolCalls?: ToolCall[];
}

export interface DiffResult {
  prompt: string;
  results: ProviderResult[];
  ranAt: string;
}

export interface RunOptions {
  prompt: string;
  providers: ProviderName[];
  config: ProviderConfig;
  runs?: number;
}

// ─── Test Suite types ─────────────────────────────────────────────────────────

export type Assertion =
  | { type: "contains";     value: string }
  | { type: "not-contains"; value: string }
  | { type: "llm-rubric";   value: string }
  | { type: "latency";      threshold: number }
  | { type: "cost";         threshold: number };

export interface TestCase {
  vars?: Record<string, string>;
  assert?: Assertion[];
}

export interface SuiteConfig {
  /** Prompt templates — use {{varName}} for interpolation */
  prompts: string[];
  tests: TestCase[];
}

export interface AssertionResult {
  type: string;
  pass: boolean;
  /** 0–1; deterministic assertions are 0 or 1; llm-rubric is 0 or 1 */
  score: number;
  reason?: string;
  /** Set for llm-rubric: the criterion text from the suite YAML */
  rubricCriterion?: string;
}

export interface ProviderTestResult extends ProviderResult {
  assertions: AssertionResult[];
  /** true only if every assertion passed */
  pass: boolean;
  /** fraction of assertions that passed (0–1) */
  score: number;
}

export interface TestCaseResult {
  /** Interpolated prompt */
  prompt: string;
  vars: Record<string, string>;
  providerResults: ProviderTestResult[];
  ranAt: string;
}

export interface ProviderSummary {
  provider: ProviderName;
  model: string;
  passed: number;
  failed: number;
  total: number;
  /** fraction of test cases passed (0–1) */
  score: number;
  avgLatencyMs: number;
  totalCostUsd: number;
}

export interface SuiteResult {
  cases: TestCaseResult[];
  summary: ProviderSummary[];
}
