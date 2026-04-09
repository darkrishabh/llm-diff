import { NextRequest, NextResponse } from "next/server";
import {
  ClaudeProvider,
  OllamaProvider,
  MinimaxProvider,
  OpenAICompatibleProvider,
  createClaudeCLIProvider,
  createCodexProvider,
  parseSuiteConfig,
  runSuite,
} from "@llm-diff/core";
import type { SuiteResult, Provider } from "@llm-diff/core";
import type { LLMInstance } from "@/types";
import { PRESET_BASE_URLS } from "@/types";

function buildProvider(instance: LLMInstance): Provider | null {
  try {
    switch (instance.provider) {
      case "claude": {
        const apiKey = instance.apiKey?.trim() || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return null;
        return new ClaudeProvider(apiKey, instance.model, {
          maxTokens: instance.maxTokens,
          temperature: instance.temperature,
        });
      }
      case "ollama":
        return new OllamaProvider(
          instance.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
          instance.model,
          { temperature: instance.temperature }
        );
      case "minimax": {
        const apiKey = instance.apiKey?.trim() || process.env.MINIMAX_API_KEY;
        const groupId = instance.groupId?.trim() || process.env.MINIMAX_GROUP_ID;
        if (!apiKey || !groupId) return null;
        return new MinimaxProvider(apiKey, groupId, instance.model, {
          maxTokens: instance.maxTokens,
          temperature: instance.temperature,
        });
      }
      case "claude-cli":
        return createClaudeCLIProvider(instance.model, { timeoutMs: 120_000 });
      case "codex":
        return createCodexProvider(instance.model, { timeoutMs: 120_000 });
      default: {
        const apiKey = instance.apiKey?.trim() || process.env[`${instance.provider.toUpperCase().replace(/-/g, "_")}_API_KEY`] || "";
        const baseUrl =
          instance.baseUrl?.trim() ||
          PRESET_BASE_URLS[instance.provider as keyof typeof PRESET_BASE_URLS] ||
          "";
        if (!baseUrl) return null;
        return new OpenAICompatibleProvider(instance.provider, baseUrl, apiKey, instance.model, {
          maxTokens: instance.maxTokens,
          temperature: instance.temperature,
        });
      }
    }
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    yaml?: string;
    instances?: LLMInstance[];
  };

  if (!body.yaml?.trim()) {
    return NextResponse.json({ error: "yaml is required" }, { status: 400 });
  }

  let config;
  try {
    config = parseSuiteConfig(body.yaml);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid suite config: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }

  const enabled = (body.instances ?? []).filter((i) => i.enabled);
  if (enabled.length === 0) {
    return NextResponse.json({ error: "no enabled instances" }, { status: 400 });
  }

  const providers = enabled.map(buildProvider).filter((p): p is Provider => p !== null);
  if (providers.length === 0) {
    return NextResponse.json({ error: "no providers could be constructed — check credentials" }, { status: 400 });
  }

  // Use claude as judge if available
  const judgeApiKey = process.env.ANTHROPIC_API_KEY;
  const judgeProvider = judgeApiKey ? new ClaudeProvider(judgeApiKey) : undefined;

  const result: SuiteResult = await runSuite({ config, providers, judgeProvider });

  return NextResponse.json(result);
}
