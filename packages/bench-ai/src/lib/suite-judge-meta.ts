/** Returned with POST /api/suite so the UI can show whether llm-rubric actually invoked a judge LLM. */
export interface SuiteJudgeMeta {
  /** Number of `llm-rubric` assertions in the parsed suite YAML */
  rubricAssertionCount: number;
  /** True only if a judge provider was constructed and the suite has at least one llm-rubric */
  willEvaluateRubrics: boolean;
  judgeMode: string;
  judgeBackend: "claude" | "ollama" | "off";
  /** e.g. claude/claude-3-5-haiku-20241022 when active */
  judgeLabel?: string;
  /** Short human-readable summary for the banner */
  summary: string;
}
