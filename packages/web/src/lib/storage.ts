import type { JudgeSettings, LLMInstance, SecretsMap } from "../types";
import { DEFAULT_JUDGE_SETTINGS } from "../types";

const KEY = "llm-diff:instances";
const SECRETS_KEY = "llm-diff:secrets";
const JUDGE_KEY = "llm-diff:judge";

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

export function loadInstances(): LLMInstance[] {
  if (typeof window === "undefined") return DEFAULT_INSTANCES;
  try {
    const raw = localStorage.getItem(KEY);
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
    const raw = localStorage.getItem(SECRETS_KEY);
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
    const raw = localStorage.getItem(JUDGE_KEY);
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
