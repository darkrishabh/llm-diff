import type { WebDiffResult } from "../types";

const HISTORY_KEY = "bench-ai:run-history";
const LEGACY_PROMPT_DIFF = "prompt-diff:run-history";
const LEGACY_LLM_DIFF = "llm-diff:run-history";
const MAX_ENTRIES = 25;

export interface RunHistoryEntry {
  id: string;
  ranAt: string;
  promptPreview: string;
  result: WebDiffResult;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readHistoryRaw(): string | null {
  if (typeof window === "undefined") return null;
  let raw = localStorage.getItem(HISTORY_KEY);
  if (raw != null) return raw;
  for (const lk of [LEGACY_PROMPT_DIFF, LEGACY_LLM_DIFF]) {
    raw = localStorage.getItem(lk);
    if (raw != null) {
      localStorage.setItem(HISTORY_KEY, raw);
      return raw;
    }
  }
  return null;
}

export function loadRunHistory(): RunHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readHistoryRaw();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RunHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRunHistory(entries: RunHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore quota */
  }
}

export function appendRunHistory(result: WebDiffResult): void {
  const prompt = result.prompt.trim();
  const preview =
    prompt.length > 120 ? `${prompt.slice(0, 117)}…` : prompt || "(empty prompt)";
  const entry: RunHistoryEntry = {
    id: uid(),
    ranAt: result.ranAt,
    promptPreview: preview,
    result,
  };
  const prev = loadRunHistory();
  saveRunHistory([entry, ...prev].slice(0, MAX_ENTRIES));
}
