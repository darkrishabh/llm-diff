import type { JudgeSettings, SecretsMap } from "../types";

/** One-line summary for suite “run target” UI */
export function describeJudgeForUi(judge: JudgeSettings, secrets: SecretsMap): string {
  const ref = judge.anthropicSecretRef?.trim() || "anthropic";
  const hasAnthropicSecret = Boolean(secrets[ref]?.trim());

  switch (judge.mode) {
    case "none":
      return "No judge — llm-rubric assertions will not be graded.";
    case "ollama":
      return `Ollama judge at ${judge.ollamaBaseUrl || "http://localhost:11434"} · model ${judge.ollamaModel || "llama3.2"}`;
    case "claude":
      return hasAnthropicSecret
        ? `Claude (${judge.claudeModel || "default"}) · API key from secret “${ref}”`
        : `Claude (${judge.claudeModel || "default"}) · key from secret “${ref}” or server ANTHROPIC_API_KEY`;
    case "auto":
    default:
      return hasAnthropicSecret
        ? `Auto · Claude when available (secret “${ref}”, ${judge.claudeModel || "default model"})`
        : `Auto · Claude if ANTHROPIC_API_KEY is set on the server (secret “${ref}” is empty)`;
  }
}
