import type { ProviderResult } from "../types.js";
import type { Provider } from "./base.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2";

export interface OllamaOptions {
  temperature?: number;
}

interface OllamaResponse {
  model: string;
  response: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements Provider {
  readonly name = "ollama";
  readonly model: string;
  private baseUrl: string;
  private options: OllamaOptions;

  constructor(baseUrl = DEFAULT_BASE_URL, model = DEFAULT_MODEL, options: OllamaOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
    this.options = options;
  }

  async complete(prompt: string): Promise<ProviderResult> {
    const start = Date.now();
    try {
      const body: Record<string, unknown> = {
        model: this.model,
        prompt,
        stream: false,
      };
      if (this.options.temperature !== undefined) {
        body.options = { temperature: this.options.temperature };
      }

      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Ollama ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as OllamaResponse;
      const latencyMs = Date.now() - start;
      const inputTokens = data.prompt_eval_count ?? 0;
      const outputTokens = data.eval_count ?? 0;

      return {
        provider: "ollama",
        model: this.model,
        output: data.response,
        latencyMs,
        inputTokens,
        outputTokens,
        costUsd: 0,
      };
    } catch (err) {
      return {
        provider: "ollama",
        model: this.model,
        output: "",
        latencyMs: Date.now() - start,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
