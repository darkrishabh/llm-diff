import type { LLMInstance } from "../types";

const KEY = "llm-diff:instances";

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
