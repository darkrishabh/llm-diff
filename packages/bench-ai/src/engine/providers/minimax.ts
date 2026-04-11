import { calcCost } from "../cost.js";
import type { ProviderResult } from "../types.js";
import type { Provider } from "./base.js";

const DEFAULT_MODEL = "abab6.5s-chat";
const BASE_URL = "https://api.minimax.chat/v1";

export interface MinimaxOptions {
  maxTokens?: number;
  temperature?: number;
}

interface MinimaxResponse {
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export class MinimaxProvider implements Provider {
  readonly name = "minimax";
  readonly model: string;
  private apiKey: string;
  private groupId: string;
  private options: MinimaxOptions;

  constructor(apiKey: string, groupId: string, model = DEFAULT_MODEL, options: MinimaxOptions = {}) {
    this.apiKey = apiKey;
    this.groupId = groupId;
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
      if (this.options.maxTokens !== undefined) body.max_tokens = this.options.maxTokens;
      if (this.options.temperature !== undefined) body.temperature = this.options.temperature;

      const res = await fetch(
        `${BASE_URL}/text/chatcompletion_v2?GroupId=${this.groupId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        throw new Error(`Minimax ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as MinimaxResponse;
      const latencyMs = Date.now() - start;
      const inputTokens = data.usage.prompt_tokens;
      const outputTokens = data.usage.completion_tokens;
      const output = data.choices[0]?.message.content ?? "";

      return {
        provider: "minimax",
        model: this.model,
        output,
        latencyMs,
        inputTokens,
        outputTokens,
        costUsd: calcCost("minimax", this.model, inputTokens, outputTokens),
      };
    } catch (err) {
      return {
        provider: "minimax",
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
