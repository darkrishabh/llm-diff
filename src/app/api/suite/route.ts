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
} from "@darkrishabh/bench-ai";
import type { SuiteConfig, SuiteResult, Provider } from "@darkrishabh/bench-ai";
import type { LLMInstance } from "@/types";
import { PRESET_BASE_URLS } from "@/types";
import type { SuiteJudgeMeta } from "@/lib/suite-judge-meta";

/** Long suite runs: raise on Vercel via plan limits (Pro supports up to 800s). */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

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

function countLlmRubricAssertions(config: SuiteConfig): number {
  let n = 0;
  for (const t of config.tests) {
    for (const a of t.assert ?? []) {
      if (a.type === "llm-rubric") n++;
    }
  }
  return n;
}

function buildSuiteJudgeMeta(
  judgeBody: {
    mode?: string;
    ollamaBaseUrl?: string;
    ollamaModel?: string;
  } | undefined,
  judgeProvider: Provider | undefined,
  rubricCount: number
): SuiteJudgeMeta {
  const mode = judgeBody?.mode ?? "auto";

  if (!judgeBody || mode === "none") {
    return {
      rubricAssertionCount: rubricCount,
      willEvaluateRubrics: false,
      judgeMode: mode,
      judgeBackend: "off",
      summary:
        rubricCount > 0
          ? `Judge is off (mode: none). ${rubricCount} llm-rubric assertion(s) did not call an LLM — enable a judge under Settings → Judge.`
          : "No llm-rubric assertions in this suite; judge settings are unused for this run.",
    };
  }

  if (mode === "ollama") {
    const url = judgeBody.ollamaBaseUrl?.trim() || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = judgeBody.ollamaModel?.trim() || "llama3.2";
    const label = `ollama/${model}`;
    const will = rubricCount > 0;
    return {
      rubricAssertionCount: rubricCount,
      willEvaluateRubrics: will,
      judgeMode: mode,
      judgeBackend: "ollama",
      judgeLabel: label,
      summary: will
        ? `Rubric judge is Ollama at ${url} (${model}). Each llm-rubric triggers a judge request — see run log lines "→ Judge LLM".`
        : `Judge is set to Ollama (${model}) but this suite has no llm-rubric assertions.`,
    };
  }

  if (judgeProvider) {
    const label = `${judgeProvider.name}/${judgeProvider.model}`;
    const will = rubricCount > 0;
    return {
      rubricAssertionCount: rubricCount,
      willEvaluateRubrics: will,
      judgeMode: mode,
      judgeBackend: "claude",
      judgeLabel: label,
      summary: will
        ? `Rubric judge is Claude (${label}). Each llm-rubric triggers a judge request — see run log lines "→ Judge LLM".`
        : `Claude judge is configured (${label}) but this suite has no llm-rubric assertions.`,
    };
  }

  return {
    rubricAssertionCount: rubricCount,
    willEvaluateRubrics: false,
    judgeMode: mode,
    judgeBackend: "off",
    summary:
      rubricCount > 0
        ? `No Anthropic API key available for the judge (${mode} mode). Add your key under Settings → Secrets for the judge variable, or set ANTHROPIC_API_KEY on the server. llm-rubric did not call Claude.`
        : "No llm-rubric assertions; Claude judge key is still missing if you add rubrics later.",
  };
}

function buildJudgeProvider(judge?: {
  mode?: string;
  anthropicApiKey?: string;
  claudeModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}): Provider | undefined {
  if (!judge || judge.mode === "none") return undefined;

  if (judge.mode === "ollama") {
    return new OllamaProvider(
      judge.ollamaBaseUrl?.trim() || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      (judge.ollamaModel || "llama3.2").trim(),
      {}
    );
  }

  const fromBody = judge.anthropicApiKey?.trim();
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  const key = fromBody || (judge.mode === "auto" || judge.mode === "claude" ? fromEnv : undefined);
  if (!key) return undefined;

  const model = judge.claudeModel?.trim() || "claude-3-5-haiku-20241022";
  return new ClaudeProvider(key, model);
}

type JudgeBody = {
  mode?: string;
  anthropicApiKey?: string;
  claudeModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
};

type SuitePostBody = {
  yaml?: string;
  instances?: LLMInstance[];
  judge?: JudgeBody;
  stream?: boolean;
};

type PreparedSuite = {
  config: SuiteConfig;
  providers: Provider[];
  judgeProvider: Provider | undefined;
  judgeMeta: SuiteJudgeMeta;
  rubricCount: number;
};

function prepareSuite(body: SuitePostBody): PreparedSuite | NextResponse {
  if (!body.yaml?.trim()) {
    return NextResponse.json({ error: "yaml is required" }, { status: 400 });
  }

  let config: SuiteConfig;
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

  const rubricCount = countLlmRubricAssertions(config);
  const judgeProvider = buildJudgeProvider(body.judge);
  const judgeMeta = buildSuiteJudgeMeta(body.judge, judgeProvider, rubricCount);

  return { config, providers, judgeProvider, judgeMeta, rubricCount };
}

async function executeSuite(
  prepared: PreparedSuite,
  emitLine?: (line: string) => void
): Promise<{ result: SuiteResult; runLog: string[]; judgeMeta: SuiteJudgeMeta }> {
  const { config, providers, judgeProvider, judgeMeta, rubricCount } = prepared;
  const runLog: string[] = [];
  const log = (message: string) => {
    const line = `[${new Date().toISOString().slice(11, 23)}] ${message}`;
    runLog.push(line);
    emitLine?.(line);
  };

  if (judgeMeta.willEvaluateRubrics && judgeMeta.judgeLabel) {
    log(`Rubric judge ACTIVE (${judgeMeta.judgeBackend}): ${judgeMeta.judgeLabel} · ${rubricCount} llm-rubric step(s)`);
  } else if (rubricCount > 0) {
    log(`Rubric judge INACTIVE — ${rubricCount} llm-rubric step(s) will not call an LLM (see summary below)`);
  } else {
    log(`No llm-rubric assertions in suite — judge not used`);
  }

  const result = await runSuite({
    config,
    providers,
    judgeProvider,
    onLog: log,
  });

  return { result, runLog, judgeMeta };
}

function sseChunk(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SuitePostBody;
  const prepared = prepareSuite(body);
  if (prepared instanceof NextResponse) return prepared;

  if (body.stream === true) {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const out = await executeSuite(prepared, (line) => {
            controller.enqueue(sseChunk({ type: "log", line }));
          });
          controller.enqueue(
            sseChunk({
              type: "done",
              result: out.result,
              runLog: out.runLog,
              judgeMeta: out.judgeMeta,
            })
          );
        } catch (e) {
          controller.enqueue(
            sseChunk({
              type: "error",
              message: e instanceof Error ? e.message : String(e),
            })
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  try {
    const out = await executeSuite(prepared);
    return NextResponse.json({ ...out.result, runLog: out.runLog, judgeMeta: out.judgeMeta });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
