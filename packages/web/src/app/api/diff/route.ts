import { NextRequest, NextResponse } from "next/server";
import {
  ClaudeProvider,
  OllamaProvider,
  MinimaxProvider,
  OpenAICompatibleProvider,
  createClaudeCLIProvider,
  createCodexProvider,
} from "@prompt-diff/core";
import type { ProviderResult } from "@prompt-diff/core";
import type { LLMInstance, WebProviderResult } from "@/types";
import { PRESET_BASE_URLS } from "@/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    prompt?: string;
    instances?: LLMInstance[];
  };

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const enabled = (body.instances ?? []).filter((i) => i.enabled);
  if (enabled.length === 0) {
    return NextResponse.json({ error: "no enabled instances" }, { status: 400 });
  }

  const results: WebProviderResult[] = await Promise.all(
    enabled.map(async (instance): Promise<WebProviderResult> => {
      const label = `${instance.provider} / ${instance.model}`;
      let base: ProviderResult;

      try {
        switch (instance.provider) {
          // ── Native providers ────────────────────────────────────────────
          case "claude": {
            const apiKey = instance.apiKey?.trim() || process.env.ANTHROPIC_API_KEY;
            if (!apiKey) throw new Error("No API key — add one in Configure or set ANTHROPIC_API_KEY");
            const p = new ClaudeProvider(apiKey, instance.model, {
              maxTokens: instance.maxTokens,
              temperature: instance.temperature,
            });
            base = await p.complete(body.prompt!);
            break;
          }

          case "ollama": {
            const p = new OllamaProvider(
              instance.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
              instance.model,
              { temperature: instance.temperature }
            );
            base = await p.complete(body.prompt!);
            break;
          }

          case "claude-cli": {
            const p = createClaudeCLIProvider(instance.model, { timeoutMs: 120_000 });
            base = await p.complete(body.prompt!);
            break;
          }

          case "codex": {
            const p = createCodexProvider(instance.model, { timeoutMs: 120_000 });
            base = await p.complete(body.prompt!);
            break;
          }

          case "minimax": {
            const apiKey = instance.apiKey?.trim() || process.env.MINIMAX_API_KEY;
            const groupId = instance.groupId?.trim() || process.env.MINIMAX_GROUP_ID;
            if (!apiKey || !groupId) throw new Error("Missing Minimax credentials — add API Key and Group ID in Configure");
            const p = new MinimaxProvider(apiKey, groupId, instance.model, {
              maxTokens: instance.maxTokens,
              temperature: instance.temperature,
            });
            base = await p.complete(body.prompt!);
            break;
          }

          // ── OpenAI-compatible providers ─────────────────────────────────
          default: {
            const apiKey = instance.apiKey?.trim() || process.env[`${instance.provider.toUpperCase().replace(/-/g, "_")}_API_KEY`] || "";
            const baseUrl =
              instance.baseUrl?.trim() ||
              PRESET_BASE_URLS[instance.provider as keyof typeof PRESET_BASE_URLS] ||
              "";

            if (!baseUrl) throw new Error(`No base URL configured for "${instance.provider}"`);

            // OpenRouter recommends an HTTP-Referer header
            const extraHeaders: Record<string, string> =
              instance.provider === "openrouter"
                ? { "HTTP-Referer": "https://github.com/darkrishabh/prompt-diff", "X-Title": "Prompt-Diff" }
                : {};

            const p = new OpenAICompatibleProvider(
              instance.provider,
              baseUrl,
              apiKey,
              instance.model,
              {
                maxTokens: instance.maxTokens,
                temperature: instance.temperature,
                extraHeaders,
              }
            );
            base = await p.complete(body.prompt!);
            break;
          }
        }
      } catch (err) {
        base = {
          provider: instance.provider,
          model: instance.model,
          output: "",
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      return { ...base, instanceId: instance.id, label };
    })
  );

  return NextResponse.json({
    prompt: body.prompt,
    results,
    ranAt: new Date().toISOString(),
  });
}
