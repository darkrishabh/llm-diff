import { NextRequest, NextResponse } from "next/server";
import { PRESET_MODELS } from "@/types";
import { filterOpenAiChatModelIds } from "@/lib/openai-model-list";

/**
 * GET /api/models?provider=ollama&baseUrl=http://localhost:11434
 *
 * Proxies model-listing APIs so the browser doesn't have to deal with CORS
 * or mixed-content issues when the target is a local server.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const provider = searchParams.get("provider");
  const baseUrl = (searchParams.get("baseUrl") ?? "").replace(/\/$/, "");

  try {
    switch (provider) {
      case "ollama": {
        const url = `${baseUrl || "http://localhost:11434"}/api/tags`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
        if (!res.ok) throw new Error(`Ollama ${res.status}`);
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        const models = (data.models ?? []).map((m) => m.name).sort();
        return NextResponse.json({ models });
      }

      default:
        return NextResponse.json({ error: `No dynamic model list for "${provider}"` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

const OPENAI_FALLBACK = PRESET_MODELS.openai;

/**
 * POST /api/models — list OpenAI chat models (requires API key from body or OPENAI_API_KEY on server).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
  };

  if (body.provider !== "openai") {
    return NextResponse.json({ error: "Only provider \"openai\" is supported for POST" }, { status: 400 });
  }

  const key = body.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  const base = (body.baseUrl?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");

  if (!key) {
    return NextResponse.json({ models: OPENAI_FALLBACK, source: "preset" as const });
  }

  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({
        models: OPENAI_FALLBACK,
        source: "preset" as const,
        error: `OpenAI ${res.status}${text ? `: ${text.slice(0, 220)}` : ""}`,
      });
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const raw = (data.data ?? []).map((m) => m.id);
    const models = filterOpenAiChatModelIds(raw);

    if (models.length === 0) {
      return NextResponse.json({
        models: OPENAI_FALLBACK,
        source: "preset" as const,
        error: "No chat-capable models returned from API",
      });
    }

    return NextResponse.json({ models, source: "api" as const });
  } catch (err) {
    return NextResponse.json({
      models: OPENAI_FALLBACK,
      source: "preset" as const,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
