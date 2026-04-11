import type { JudgeSettings, LLMInstance, SecretsMap } from "../types";
import { DEFAULT_JUDGE_SETTINGS } from "../types";

const KEY = "prompt-diff:instances";
const SECRETS_KEY = "prompt-diff:secrets";
const JUDGE_KEY = "prompt-diff:judge";

/** Migrated once from `llm-diff:*` localStorage keys */
const LEGACY_INSTANCES = "llm-diff:instances";
const LEGACY_SECRETS = "llm-diff:secrets";
const LEGACY_JUDGE = "llm-diff:judge";

export const DEFAULT_INSTANCES: LLMInstance[] = [
  {
    id: "claude-default",
    provider: "claude",
    model: "claude-3-5-haiku-20241022",
    enabled: true,
    maxTokens: 2048,
    temperature: 0.7,
  },
  {
    id: "ollama-default",
    provider: "ollama",
    model: "llama3.2",
    enabled: true,
    baseUrl: "http://localhost:11434",
    temperature: 0.7,
  },
];

function readLocalStorage(key: string, legacyKey: string): string | null {
  if (typeof window === "undefined") return null;
  let raw = localStorage.getItem(key);
  if (raw == null) {
    raw = localStorage.getItem(legacyKey);
    if (raw != null) localStorage.setItem(key, raw);
  }
  return raw;
}

export function loadInstances(): LLMInstance[] {
  if (typeof window === "undefined") return DEFAULT_INSTANCES;
  try {
    const raw = readLocalStorage(KEY, LEGACY_INSTANCES);
    return raw ? (JSON.parse(raw) as LLMInstance[]) : DEFAULT_INSTANCES;
  } catch {
    return DEFAULT_INSTANCES;
  }
}

export function saveInstances(instances: LLMInstance[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(instances));
}

export function loadSecrets(): SecretsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = readLocalStorage(SECRETS_KEY, LEGACY_SECRETS);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return {};
    return p as SecretsMap;
  } catch {
    return {};
  }
}

export function saveSecrets(secrets: SecretsMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
}

export function loadJudgeSettings(): JudgeSettings {
  if (typeof window === "undefined") return DEFAULT_JUDGE_SETTINGS;
  try {
    const raw = readLocalStorage(JUDGE_KEY, LEGACY_JUDGE);
    if (!raw) return DEFAULT_JUDGE_SETTINGS;
    const p = JSON.parse(raw) as Partial<JudgeSettings>;
    return { ...DEFAULT_JUDGE_SETTINGS, ...p };
  } catch {
    return DEFAULT_JUDGE_SETTINGS;
  }
}

export function saveJudgeSettings(judge: JudgeSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(JUDGE_KEY, JSON.stringify(judge));
}
