import { calcCost } from "../cost.js";
import type { ProviderResult } from "../types.js";
import type { Provider } from "./base.js";

export interface OpenAICompatibleOptions {
  maxTokens?: number;
  temperature?: number;
  /** Extra headers to merge into every request (e.g. HTTP-Referer for OpenRouter) */
  extraHeaders?: Record<string, string>;
}

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string }; finish_reason?: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model?: string;
}

function modelTail(model: string): string {
  const id = model.toLowerCase();
  return id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
}

/**
 * Models that reject `max_tokens` and require `max_completion_tokens` on Chat Completions
 * (o-series, GPT-5 family, including OpenRouter-style ids like `openai/gpt-5.4`).
 */
function openAiUsesMaxCompletionTokens(model: string): boolean {
  const tail = modelTail(model);
  if (/^o\d/.test(tail)) return true;
  if (tail.startsWith("gpt-5")) return true;
  return false;
}

/**
 * GPT-5.4 / GPT-5.2 lines: `temperature`, `top_p`, and `logprobs` are allowed when reasoning
 * effort is `none` (the default for gpt-5.4 per OpenAI). Older `gpt-5` / `gpt-5-mini` / `o*`
 * reject those fields or use different rules — we omit temperature unless this matches.
 *
 * @see https://platform.openai.com/docs/guides/latest-model
 */
function openAiGpt5DotSeriesAllowsSamplingParams(model: string): boolean {
  const tail = modelTail(model);
  return /^gpt-5\.4/.test(tail) || /^gpt-5\.2/.test(tail);
}

export class OpenAICompatibleProvider implements Provider {
  /** Shown as `provider` in ProviderResult — pass the human name, e.g. "openai", "groq" */
  readonly name: string;
  readonly model: string;
  private baseUrl: string;
  private apiKey: string;
  private options: OpenAICompatibleOptions;

  constructor(
    name: string,
    baseUrl: string,
    apiKey: string,
    model: string,
    options: OpenAICompatibleOptions = {}
  ) {
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.model = model;
    this.options = options;
  }

  async complete(prompt: string): Promise<ProviderResult> {
    const start = Date.now();
    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages: [{ role: "user", content: prompt }],
      };
      if (this.options.maxTokens) {
        if (openAiUsesMaxCompletionTokens(this.model)) {
          body.max_completion_tokens = this.options.maxTokens;
        } else {
          body.max_tokens = this.options.maxTokens;
        }
      }
      if (this.options.temperature !== undefined) {
        if (openAiGpt5DotSeriesAllowsSamplingParams(this.model)) {
          body.temperature = this.options.temperature;
        } else if (!openAiUsesMaxCompletionTokens(this.model)) {
          body.temperature = this.options.temperature;
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...this.options.extraHeaders,
      };
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`${this.name} ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as OpenAIChatResponse;
      const latencyMs = Date.now() - start;
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const output = data.choices[0]?.message.content ?? "";

      return {
        provider: this.name,
        model: this.model,
        output,
        latencyMs,
        inputTokens,
        outputTokens,
        costUsd: calcCost(this.name, this.model, inputTokens, outputTokens),
      };
    } catch (err) {
      return {
        provider: this.name,
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
