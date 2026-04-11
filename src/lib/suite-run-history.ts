import type { SuiteResult } from "@bench/engine";
import type { SuiteJudgeMeta } from "./suite-judge-meta";

const HISTORY_KEY = "bench-ai:suite-run-history";
const LEGACY_PROMPT_DIFF = "prompt-diff:suite-run-history";
const LEGACY_LLM_DIFF = "llm-diff:suite-run-history";
/** Fewer than diff runs — suite payloads include full outputs per case. */
const MAX_ENTRIES = 15;

export interface SuiteRunHistoryEntry {
  id: string;
  ranAt: string;
  /** Short label for the list (first meaningful YAML line) */
  yamlPreview: string;
  yaml: string;
  result: SuiteResult;
  runLog: string[];
  judgeMeta: SuiteJudgeMeta | null;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function previewFromYaml(yaml: string): string {
  const lines = yaml.split(/\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    return t.length > 115 ? `${t.slice(0, 112)}…` : t;
  }
  return "(empty suite)";
}

function readSuiteHistoryRaw(): string | null {
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

export function loadSuiteRunHistory(): SuiteRunHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readSuiteHistoryRaw();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SuiteRunHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSuiteRunHistory(entries: SuiteRunHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore quota */
  }
}

export function appendSuiteRunHistory(
  payload: Omit<SuiteRunHistoryEntry, "id" | "yamlPreview">
): void {
  const yamlPreview = previewFromYaml(payload.yaml);
  const entry: SuiteRunHistoryEntry = {
    id: uid(),
    yamlPreview,
    ...payload,
  };
  const prev = loadSuiteRunHistory();
  saveSuiteRunHistory([entry, ...prev]);
}
