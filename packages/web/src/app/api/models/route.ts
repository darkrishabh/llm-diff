import { NextRequest, NextResponse } from "next/server";

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
