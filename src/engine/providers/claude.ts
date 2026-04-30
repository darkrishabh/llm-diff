import Anthropic from "@anthropic-ai/sdk";
import { calcCost } from "../cost.js";
import type { ProviderResult } from "../types.js";
import type { Provider } from "./base.js";

const DEFAULT_MODEL = "claude-3-5-haiku-20241022";

export interface ClaudeOptions {
  maxTokens?: number;
  temperature?: number;
}

export class ClaudeProvider implements Provider {
  readonly name = "claude";
  readonly model: string;
  private client: Anthropic;
  private options: ClaudeOptions;

  constructor(apiKey: string, model = DEFAULT_MODEL, options: ClaudeOptions = {}) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.options = options;
  }

  async complete(prompt: string): Promise<ProviderResult> {
    const start = Date.now();
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.options.maxTokens ?? 2048,
        ...(this.options.temperature !== undefined
          ? { temperature: this.options.temperature }
          : {}),
        messages: [{ role: "user", content: prompt }],
      });

      const latencyMs = Date.now() - start;
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const output =
        response.content[0].type === "text" ? response.content[0].text : "";

      return {
        provider: "claude",
        model: this.model,
        output,
        latencyMs,
        inputTokens,
        outputTokens,
        costUsd: calcCost("claude", this.model, inputTokens, outputTokens),
      };
    } catch (err) {
      return {
        provider: "claude",
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
