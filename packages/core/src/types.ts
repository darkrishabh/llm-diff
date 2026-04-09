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

export interface ProviderResult {
  provider: ProviderName;
  model: string;
  output: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error?: string;
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
