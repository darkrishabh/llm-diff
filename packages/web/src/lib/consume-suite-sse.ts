import type { SuiteResult } from "@llm-diff/core";
import type { SuiteJudgeMeta } from "./suite-judge-meta";

type SsePayload =
  | { type: "log"; line: string }
  | { type: "done"; result: SuiteResult; runLog: string[]; judgeMeta: SuiteJudgeMeta }
  | { type: "error"; message: string };

/**
 * Read a POST /api/suite response with Content-Type: text/event-stream.
 * Invokes onLogLine for each log line as it arrives.
 */
export async function consumeSuiteSseStream(
  res: Response,
  onLogLine: (line: string) => void
): Promise<{ result: SuiteResult; runLog: string[]; judgeMeta: SuiteJudgeMeta | null }> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let final: { result: SuiteResult; runLog: string[]; judgeMeta: SuiteJudgeMeta | null } | null = null;

  const parseBlock = (block: string) => {
    const lines = block.split("\n").filter((l) => l.startsWith("data:"));
    if (lines.length === 0) return;
    const jsonStr = lines.map((l) => l.replace(/^data:\s?/, "")).join("\n");
    let msg: SsePayload;
    try {
      msg = JSON.parse(jsonStr) as SsePayload;
    } catch {
      return;
    }
    if (msg.type === "log") onLogLine(msg.line);
    if (msg.type === "error") throw new Error(msg.message);
    if (msg.type === "done") {
      final = {
        result: msg.result,
        runLog: msg.runLog,
        judgeMeta: msg.judgeMeta ?? null,
      };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const idx = buffer.indexOf("\n\n");
      if (idx === -1) break;
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      parseBlock(block);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    for (const block of buffer.split("\n\n")) {
      if (block.trim()) parseBlock(block);
    }
  }

  if (!final) {
    throw new Error("Stream ended without a result event");
  }
  return final;
}
