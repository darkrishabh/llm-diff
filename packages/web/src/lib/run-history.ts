import type { WebDiffResult } from "../types";

const HISTORY_KEY = "llm-diff:run-history";
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

export function loadRunHistory(): RunHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
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
