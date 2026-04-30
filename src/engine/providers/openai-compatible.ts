import type { ProviderResult } from "../types.js";
import type { Provider } from "./base.js";
import type { AttachedFile } from "../../skills/types.js";

export interface OpenAICompatibleOptions {
  providerName?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Extra headers to merge into every request (e.g. HTTP-Referer for OpenRouter) */
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
  retry?: {
    attempts?: number;
    backoffMs?: number;
  };
}

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string }; finish_reason?: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    costs?: {
      prompt?: number;
      completion?: number;
    };
  };
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
  readonly capabilities = { systemRole: true, attachments: false };
  /** Shown as `provider` in ProviderResult — pass the human name, e.g. "openai", "groq" */
  readonly name: string;
  readonly model: string;
  private baseUrl: string;
  private apiKey: string;
  private options: OpenAICompatibleOptions;

  constructor(
    nameOrOptions: string | (OpenAICompatibleOptions & { baseUrl: string; apiKey: string }),
    baseUrl?: string,
    apiKey?: string,
    model?: string,
    options: OpenAICompatibleOptions = {}
  ) {
    if (typeof nameOrOptions === "string") {
      this.name = nameOrOptions;
      this.baseUrl = (baseUrl ?? "").replace(/\/$/, "");
      this.apiKey = apiKey ?? "";
      this.model = model ?? "gpt-4o-mini";
      this.options = options;
    } else {
      this.name = nameOrOptions.providerName ?? "openai-compatible";
      this.baseUrl = nameOrOptions.baseUrl.replace(/\/$/, "");
      this.apiKey = nameOrOptions.apiKey;
      this.model = nameOrOptions.model ?? "gpt-4o-mini";
      this.options = nameOrOptions;
    }
  }

  async complete(prompt: string): Promise<ProviderResult> {
    return this.completeChat({ user: prompt });
  }

  async completeChat(args: {
    system?: string;
    user: string;
    attachments?: AttachedFile[];
  }): Promise<ProviderResult> {
    const start = Date.now();
    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages: [
          ...(args.system ? [{ role: "system", content: args.system }] : []),
          { role: "user", content: args.user },
        ],
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

      const data = await this.fetchWithRetry(body, headers);

      const latencyMs = Date.now() - start;
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const output = data.choices[0]?.message.content ?? "";
      const promptCost = data.usage?.costs?.prompt ?? 0;
      const completionCost = data.usage?.costs?.completion ?? 0;

      return {
        provider: this.name,
        model: this.model,
        output,
        latencyMs,
        inputTokens,
        outputTokens,
        costUsd: promptCost + completionCost,
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

  private async fetchWithRetry(
    body: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<OpenAIChatResponse> {
    const attempts = this.options.retry?.attempts ?? 2;
    const backoffMs = this.options.retry?.backoffMs ?? 1500;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = this.options.timeoutMs ? new AbortController() : undefined;
      const timer = controller
        ? setTimeout(() => controller.abort(), this.options.timeoutMs)
        : undefined;
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller?.signal,
        });

        if (!res.ok) {
          throw new Error(`${this.name} ${res.status}: ${await res.text()}`);
        }

        return (await res.json()) as OpenAIChatResponse;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
        }
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    throw lastError ?? new Error(`${this.name}: request failed`);
  }
}
