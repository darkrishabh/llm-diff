import type { ProviderResult } from "@llm-diff/core";

// ─── Provider names ───────────────────────────────────────────────────────────

/** Native (hand-rolled) providers */
export type NativeProvider = "claude" | "ollama" | "minimax" | "claude-cli" | "codex";

/** OpenAI-compatible presets + catch-all custom */
export type OAIPreset =
  | "openai"
  | "groq"
  | "openrouter"
  | "nvidia-nim"
  | "together"
  | "perplexity"
  | "custom";

export type AnyProvider = NativeProvider | OAIPreset;

// ─── Preset base URLs ─────────────────────────────────────────────────────────

export const PRESET_BASE_URLS: Record<OAIPreset, string> = {
  openai:      "https://api.openai.com/v1",
  groq:        "https://api.groq.com/openai/v1",
  openrouter:  "https://openrouter.ai/api/v1",
  "nvidia-nim":"https://integrate.api.nvidia.com/v1",
  together:    "https://api.together.xyz/v1",
  perplexity:  "https://api.perplexity.ai",
  custom:      "",
};

// ─── Per-preset model suggestions ────────────────────────────────────────────

export const PRESET_MODELS: Record<AnyProvider, string[]> = {
  claude:      ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022", "claude-opus-4-5"],
  ollama:      ["llama3.2", "llama3.1", "mistral", "codellama", "phi3", "gemma2", "qwen2.5"],
  minimax:     ["abab6.5s-chat", "abab6.5-chat"],
  "claude-cli": [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
  ],
  codex: ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1-mini", "o1"],
  openai:  ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini"],
  groq:    ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
  openrouter: [
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-flash-1.5",
    "mistralai/mistral-7b-instruct",
    "meta-llama/llama-3.1-70b-instruct",
    "deepseek/deepseek-chat",
  ],
  "nvidia-nim": [
    "meta/llama-3.1-405b-instruct",
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "meta/llama-3.1-70b-instruct",
    "mistralai/mistral-large-2-instruct",
  ],
  together: [
    "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    "mistralai/Mixtral-8x22B-Instruct-v0.1",
    "google/gemma-2-27b-it",
  ],
  perplexity: [
    "llama-3.1-sonar-large-128k-online",
    "llama-3.1-sonar-small-128k-online",
  ],
  custom: [],
};

// ─── LLM instance ─────────────────────────────────────────────────────────────

export interface LLMInstance {
  id: string;
  provider: AnyProvider;
  model: string;
  enabled: boolean;
  // Credentials & endpoints
  apiKey?: string;
  baseUrl?: string;
  groupId?: string;      // Minimax only
  // Generation params
  maxTokens?: number;
  temperature?: number;
}

// ─── Web result types ─────────────────────────────────────────────────────────

export interface WebProviderResult extends ProviderResult {
  instanceId: string;
  label: string;
}

export interface WebDiffResult {
  prompt: string;
  ranAt: string;
  results: WebProviderResult[];
}
