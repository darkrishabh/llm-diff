import type { JudgeSettings, LLMInstance } from "../types";
import { DEFAULT_JUDGE_SETTINGS } from "../types";

/** Merge inline keys + secret variables for API routes. Omits ref fields from the payload. */
export function resolveInstancesForApi(
  instances: LLMInstance[],
  secrets: Record<string, string>
): LLMInstance[] {
  return instances.map((i) => resolveInstanceForApi(i, secrets));
}

export function resolveInstanceForApi(
  instance: LLMInstance,
  secrets: Record<string, string>
): LLMInstance {
  const fromRef = (ref: string | undefined) =>
    ref?.trim() ? secrets[ref.trim()]?.trim() ?? "" : "";

  const apiKeyRefVal = fromRef(instance.apiKeySecretRef);
  const groupRefVal = fromRef(instance.groupIdSecretRef);

  const apiKey =
    (apiKeyRefVal || instance.apiKey?.trim() || undefined) ?? undefined;
  const groupId =
    (groupRefVal || instance.groupId?.trim() || undefined) ?? undefined;

  const {
    apiKeySecretRef: _a,
    groupIdSecretRef: _g,
    ...rest
  } = instance;

  return {
    ...rest,
    apiKey,
    groupId,
  };
}

/** Payload sent to /api/suite for llm-rubric judge construction. */
export interface JudgeApiPayload {
  mode: string;
  anthropicApiKey?: string;
  claudeModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

export function buildJudgeApiPayload(
  judge: JudgeSettings,
  secrets: Record<string, string>
): JudgeApiPayload {
  const j = { ...DEFAULT_JUDGE_SETTINGS, ...judge };
  const ref = j.anthropicSecretRef?.trim() || "anthropic";
  const anthropicApiKey = secrets[ref]?.trim() || undefined;

  if (j.mode === "none") {
    return { mode: "none" };
  }
  if (j.mode === "ollama") {
    return {
      mode: "ollama",
      ollamaBaseUrl: j.ollamaBaseUrl?.trim() || "http://localhost:11434",
      ollamaModel: j.ollamaModel?.trim() || "llama3.2",
    };
  }
  if (j.mode === "claude") {
    return {
      mode: "claude",
      anthropicApiKey,
      claudeModel: j.claudeModel?.trim() || DEFAULT_JUDGE_SETTINGS.claudeModel,
    };
  }
  // auto
  return {
    mode: "auto",
    anthropicApiKey,
    claudeModel: j.claudeModel?.trim() || DEFAULT_JUDGE_SETTINGS.claudeModel,
  };
}
