"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import type { SuiteResult, TestCaseResult, ProviderSummary, AssertionResult } from "bench-ai";
import type { JudgeSettings, LLMInstance, SecretsMap } from "../types";
import { formatCost } from "bench-ai";
import { buildJudgeApiPayload, resolveInstancesForApi } from "../lib/resolve-credentials";
import { providerUi } from "../lib/provider-ui";
import { describeJudgeForUi } from "../lib/describe-judge";
import type { SuiteJudgeMeta } from "../lib/suite-judge-meta";
import { consumeSuiteSseStream } from "../lib/consume-suite-sse";
import {
  appendSuiteRunHistory,
  loadSuiteRunHistory,
  type SuiteRunHistoryEntry,
} from "../lib/suite-run-history";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXAMPLE_YAML = `prompts:
  - "Explain {{concept}} in one paragraph"
  - "Write a {{language}} function that {{task}}"

tests:
  - vars:
      concept: "recursion"
      language: "Python"
      task: "reverses a linked list"
    assert:
      - type: contains
        value: "base case"
      - type: latency
        threshold: 8000
      - type: cost
        threshold: 0.01

  - vars:
      concept: "gradient descent"
      language: "TypeScript"
      task: "debounces a function"
    assert:
      - type: llm-rubric
        value: "explains it clearly without excessive jargon"
      - type: latency
        threshold: 8000
`;

function scoreColor(score: number): string {
  if (score >= 0.8) return "var(--green)";
  if (score >= 0.5) return "var(--amber, #f59e0b)";
  return "var(--red)";
}

function ScoreBadge({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.3rem",
      padding: "0.15rem 0.5rem", borderRadius: 5,
      background: color + "18", border: `1px solid ${color}35`,
      color, fontWeight: 700, fontSize: "0.78rem",
    }}>
      {Math.round(score * 100)}%
    </span>
  );
}

function PassFail({ pass }: { pass: boolean }) {
  return (
    <span style={{
      color: pass ? "var(--green)" : "var(--red)",
      fontWeight: 700, fontSize: "0.82rem",
    }}>
      {pass ? "✓" : "✗"}
    </span>
  );
}

// ─── Summary table ────────────────────────────────────────────────────────────

function SummaryTable({ summary }: { summary: ProviderSummary[] }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)", overflow: "hidden", boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{ padding: "0.75rem 1.2rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "-0.01em", color: "var(--text-1)", background: "var(--surface-subtle)" }}>
        Provider summary
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ background: "var(--surface-subtle)" }}>
              {["Provider", "Model", "Score", "Passed", "Failed", "Avg Latency", "Total Cost"].map((h) => (
                <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "left", color: "var(--text-3)", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={`${s.provider}/${s.model}`} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.65rem 1rem", fontWeight: 600, color: "var(--text-1)" }}>{s.provider}</td>
                <td style={{ padding: "0.65rem 1rem", color: "var(--text-2)", fontFamily: "monospace", fontSize: "0.78rem" }}>{s.model}</td>
                <td style={{ padding: "0.65rem 1rem" }}><ScoreBadge score={s.score} /></td>
                <td style={{ padding: "0.65rem 1rem", color: "var(--green)", fontWeight: 600 }}>{s.passed}</td>
                <td style={{ padding: "0.65rem 1rem", color: s.failed > 0 ? "var(--red)" : "var(--text-3)", fontWeight: s.failed > 0 ? 600 : 400 }}>{s.failed}</td>
                <td style={{ padding: "0.65rem 1rem", color: "var(--text-2)" }}>{s.avgLatencyMs.toLocaleString()}ms</td>
                <td style={{ padding: "0.65rem 1rem", color: "var(--text-2)" }}>{s.totalCostUsd === 0 ? "$0.00" : formatCost(s.totalCostUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Results table (rows = cases, columns = providers) ────────────────────────

function AssertionChip({ a }: { a: AssertionResult }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.3rem", fontSize: "0.72rem" }}>
      <span style={{ color: a.pass ? "var(--green)" : "var(--red)", flexShrink: 0 }}>{a.pass ? "✓" : "✗"}</span>
      <span style={{ color: "var(--text-3)" }}>[{a.type}]{a.reason ? ` — ${a.reason}` : ""}</span>
    </div>
  );
}

/** Rich block for judge-backed rubric: criterion, verdict, and rationale */
function LlmRubricJudgmentCard({ a }: { a: AssertionResult }) {
  const criterion =
    a.rubricCriterion?.trim() ||
    "Criterion text was not stored (re-run the suite with the current app version).";
  const verdictColor = a.pass ? "var(--green)" : "var(--red)";
  const verdictBg = a.pass ? "var(--green-subtle)" : "var(--red-subtle)";

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        background: "var(--surface)",
        padding: "0.65rem 0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem",
      }}
    >
      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        LLM rubric (judge)
      </div>

      <div
        style={{
          padding: "0.5rem 0.6rem",
          borderRadius: 6,
          background: "var(--surface-muted)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-3)", marginBottom: "0.25rem" }}>Rubric detail</div>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-1)", lineHeight: 1.5 }}>{criterion}</p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Verdict
        </span>
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: verdictColor,
            background: verdictBg,
            padding: "0.2rem 0.55rem",
            borderRadius: 6,
            border: `1px solid ${a.pass ? "rgba(4, 120, 87, 0.22)" : "rgba(185, 28, 28, 0.2)"}`,
          }}
        >
          {a.pass ? "Pass" : "Fail"}
        </span>
      </div>

      <div>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-3)", marginBottom: "0.3rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {a.pass ? "Why it passed" : "Why it failed"}
        </div>
        <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--text-2)", lineHeight: 1.55 }}>{a.reason}</p>
      </div>
    </div>
  );
}

function AssertionBlock({ a }: { a: AssertionResult }) {
  if (a.type === "llm-rubric") return <LlmRubricJudgmentCard a={a} />;
  return <AssertionChip a={a} />;
}

function JudgeRunSummary({ meta }: { meta: SuiteJudgeMeta }) {
  const active = meta.willEvaluateRubrics;
  const missing = meta.rubricAssertionCount > 0 && !meta.willEvaluateRubrics;
  const idle = meta.rubricAssertionCount === 0;

  const palette = active
    ? {
        bg: "var(--green-subtle)",
        border: "rgba(4, 120, 87, 0.22)",
        title: "Rubric judge: active",
        titleColor: "var(--green)",
      }
    : missing
      ? {
          bg: "var(--amber-subtle)",
          border: "rgba(180, 83, 9, 0.28)",
          title: "Rubric judge: not calling an LLM",
          titleColor: "var(--amber)",
        }
      : {
          bg: "var(--surface-muted)",
          border: "var(--border)",
          title: "llm-rubric",
          titleColor: "var(--text-2)",
        };

  return (
    <div
      style={{
        padding: "0.85rem 1.1rem",
        borderRadius: "var(--r-lg)",
        background: palette.bg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.35rem" }}>
        {palette.title}
      </div>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.84rem", color: "var(--text-1)", lineHeight: 1.55, fontWeight: 600 }}>
        {meta.summary}
      </p>
      <div style={{ fontSize: "0.72rem", color: "var(--text-3)", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: palette.titleColor }}>{meta.rubricAssertionCount}</span>
        {" · "}
        <code style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)" }}>llm-rubric</code> assertion(s) in YAML · Judge
        mode: <code style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)" }}>{meta.judgeMode}</code>
        {meta.judgeLabel ? (
          <>
            {" · "}
            Backend: <code style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)" }}>{meta.judgeLabel}</code>
          </>
        ) : null}
      </div>
      {!idle && (
        <p style={{ margin: "0.55rem 0 0", fontSize: "0.72rem", color: "var(--text-3)", lineHeight: 1.45 }}>
          {active
            ? 'Confirm in the run log: each rubric should show "→ Judge LLM" before "← Judge".'
            : 'Fix judge settings (Secrets + Judge tab), then re-run. Assertions may show "No judge provider configured".'}
        </p>
      )}
    </div>
  );
}

function ResultsTable({ cases, summary }: { cases: TestCaseResult[]; summary: ProviderSummary[] }) {
  const [expandedCase, setExpandedCase] = useState<number | null>(null);
  const providerKeys = summary.map((s) => `${s.provider}/${s.model}`);

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-xl)", overflow: "hidden", boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{ padding: "0.75rem 1.2rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "-0.01em", color: "var(--text-1)", background: "var(--surface-subtle)" }}>
        Test matrix
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ background: "var(--surface-subtle)" }}>
              <th style={{ padding: "0.6rem 1rem", textAlign: "left", color: "var(--text-3)", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)", minWidth: 220 }}>
                Prompt / Vars
              </th>
              {providerKeys.map((k) => (
                <th key={k} style={{ padding: "0.6rem 1rem", textAlign: "center", color: "var(--text-3)", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)", minWidth: 120, whiteSpace: "nowrap" }}>
                  {k.split("/")[0]}<br />
                  <span style={{ fontWeight: 400, fontFamily: "monospace" }}>{k.split("/").slice(1).join("/")}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c, i) => {
              const isExpanded = expandedCase === i;
              const varStr = Object.entries(c.vars).map(([k, v]) => `${k}=${v}`).join(", ");
              return (
                <React.Fragment key={i}>
                  <tr
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.1s" }}
                    onClick={() => setExpandedCase(isExpanded ? null : i)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <td style={{ padding: "0.65rem 1rem" }}>
                      <div style={{ color: "var(--text-1)", fontSize: "0.8rem", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.prompt}>
                        {c.prompt}
                      </div>
                      {varStr && (
                        <div style={{ color: "var(--text-3)", fontSize: "0.72rem", marginTop: "0.15rem" }}>{varStr}</div>
                      )}
                    </td>
                    {providerKeys.map((k) => {
                      const pr = c.providerResults.find((r) => `${r.provider}/${r.model}` === k);
                      if (!pr) return <td key={k} style={{ padding: "0.65rem 1rem", textAlign: "center", color: "var(--text-3)" }}>—</td>;
                      return (
                        <td key={k} style={{ padding: "0.65rem 1rem", textAlign: "center" }}>
                          {pr.error ? (
                            <span style={{ color: "var(--red)", fontSize: "0.72rem" }}>Error</span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                              <PassFail pass={pr.pass} />
                              {pr.assertions.length > 0 && (
                                <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
                                  {pr.assertions.filter((a) => a.pass).length}/{pr.assertions.length}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
                      <td colSpan={providerKeys.length + 1} style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${providerKeys.length}, 1fr)`, gap: "1rem" }}>
                          {providerKeys.map((k) => {
                            const pr = c.providerResults.find((r) => `${r.provider}/${r.model}` === k);
                            if (!pr) return <div key={k} />;
                            return (
                              <div key={k} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                <div style={{ fontWeight: 600, fontSize: "0.75rem", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
                                {pr.error ? (
                                  <div style={{ color: "var(--red)", fontSize: "0.78rem" }}>{pr.error}</div>
                                ) : (
                                  <>
                                    <div style={{ color: "var(--text-3)", fontSize: "0.72rem" }}>
                                      {pr.latencyMs}ms · {pr.outputTokens > 0 ? `${pr.outputTokens} tokens` : ""}
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-2)", maxHeight: 120, overflowY: "auto", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                      {pr.output}
                                    </div>
                                    {pr.assertions.length > 0 && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem", paddingTop: "0.25rem", borderTop: "1px solid var(--border)" }}>
                                        {pr.assertions.map((a, ai) => <AssertionBlock key={ai} a={a} />)}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Run target (what the suite executes against) ─────────────────────────────

function RunTargetBanner({
  instances,
  secrets,
  judge,
  onOpenSettings,
}: {
  instances: LLMInstance[];
  secrets: SecretsMap;
  judge: JudgeSettings;
  onOpenSettings?: () => void;
}) {
  const enabled = instances.filter((i) => i.enabled);
  const judgeLine = describeJudgeForUi(judge, secrets);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          padding: "0.65rem 1.15rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "var(--text-3)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Run target
        </span>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              padding: "0.25rem 0.65rem",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-2)",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Change in Settings
          </button>
        )}
      </div>
      <div style={{ padding: "0.9rem 1.15rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)", marginBottom: "0.45rem", letterSpacing: "0.03em" }}>
            Enabled models
          </div>
          {enabled.length === 0 ? (
            <span style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>No models enabled — enable at least one in Settings.</span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {enabled.map((i) => {
                const { color, border } = providerUi(i.provider);
                return (
                  <span
                    key={i.id}
                    style={{
                      padding: "0.28rem 0.65rem",
                      borderRadius: 8,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      background: "var(--surface-muted)",
                      border: `1px solid ${border}`,
                      color,
                      whiteSpace: "nowrap",
                      boxShadow: "var(--shadow-xs)",
                    }}
                  >
                    {i.provider}
                    <span style={{ color: "var(--text-3)", fontWeight: 500, margin: "0 0.25rem" }}>·</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "0.68rem" }}>{i.model}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)", marginBottom: "0.35rem", letterSpacing: "0.03em" }}>
            Judge (llm-rubric)
          </div>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-2)", lineHeight: 1.55 }}>{judgeLine}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main SuitePanel ──────────────────────────────────────────────────────────

interface SuitePanelProps {
  instances: LLMInstance[];
  secrets: SecretsMap;
  judge: JudgeSettings;
  onOpenSettings?: () => void;
}

type SuiteApiResponse = SuiteResult & { runLog?: string[]; judgeMeta?: SuiteJudgeMeta };

export function SuitePanel({ instances, secrets, judge, onOpenSettings }: SuitePanelProps) {
  const [yaml, setYaml] = useState(EXAMPLE_YAML);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuiteResult | null>(null);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [judgeMeta, setJudgeMeta] = useState<SuiteJudgeMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const logPreRef = useRef<HTMLPreElement>(null);

  const historyEntries = useMemo(() => loadSuiteRunHistory(), [historyVersion]);

  useEffect(() => {
    if (!loading || !logPreRef.current) return;
    logPreRef.current.scrollTop = logPreRef.current.scrollHeight;
  }, [runLog, loading]);

  const enabled = instances.filter((i) => i.enabled);
  const canRun = enabled.length > 0 && yaml.trim().length > 0 && !loading;

  const restoreHistoryEntry = (e: SuiteRunHistoryEntry) => {
    setYaml(e.yaml);
    setResult(e.result);
    setRunLog(e.runLog);
    setJudgeMeta(e.judgeMeta);
    setError(null);
  };

  const run = async () => {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRunLog([]);
    setJudgeMeta(null);
    try {
      const resolved = resolveInstancesForApi(instances, secrets);
      const judgePayload = buildJudgeApiPayload(judge, secrets);
      const res = await fetch("/api/suite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          yaml,
          instances: resolved,
          judge: judgePayload,
          stream: true,
        }),
      });

      const ct = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }

      if (!ct.includes("text/event-stream")) {
        const body = (await res.json()) as SuiteApiResponse | { error?: string };
        if ("error" in body && body.error) throw new Error(body.error);
        const { runLog: lines, judgeMeta: jm, cases, summary } = body as SuiteApiResponse;
        if (!Array.isArray(cases) || !Array.isArray(summary)) throw new Error("Invalid suite response");
        const suiteResult = { cases, summary };
        const logLines = Array.isArray(lines) ? lines : [];
        const meta = jm ?? null;
        setResult(suiteResult);
        setRunLog(logLines);
        setJudgeMeta(meta);
        appendSuiteRunHistory({
          yaml,
          result: suiteResult,
          runLog: logLines,
          judgeMeta: meta,
          ranAt: new Date().toISOString(),
        });
        setHistoryVersion((v) => v + 1);
      } else {
        const out = await consumeSuiteSseStream(res, (line) => {
          setRunLog((prev) => [...prev, line]);
        });
        const suiteResult = { cases: out.result.cases, summary: out.result.summary };
        const meta = out.judgeMeta;
        setResult(suiteResult);
        setRunLog(out.runLog);
        setJudgeMeta(meta);
        appendSuiteRunHistory({
          yaml,
          result: suiteResult,
          runLog: out.runLog,
          judgeMeta: meta,
          ranAt: new Date().toISOString(),
        });
        setHistoryVersion((v) => v + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const allPassed = result ? result.summary.every((s) => s.failed === 0) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.35rem" }}>
      <RunTargetBanner instances={instances} secrets={secrets} judge={judge} onOpenSettings={onOpenSettings} />

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            padding: "0.65rem 1.1rem",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-subtle)",
            fontWeight: 600,
            fontSize: "0.72rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Recent suite runs
        </div>
        {historyEntries.length === 0 ? (
          <div style={{ padding: "1.1rem 1.15rem", color: "var(--text-3)", fontSize: "0.8125rem", margin: 0 }}>
            No saved runs yet. Each successful suite run is stored in this browser (up to 15).
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {historyEntries.map((entry, idx) => (
              <li
                key={entry.id}
                style={{
                  borderBottom: idx < historyEntries.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <button
                  type="button"
                  onClick={() => restoreHistoryEntry(entry)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.75rem 1.1rem",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--surface-subtle)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginBottom: "0.25rem" }}>
                    {new Date(entry.ranAt).toLocaleString()} · {entry.result.cases.length} case
                    {entry.result.cases.length !== 1 ? "s" : ""} · {entry.result.summary.length} model
                    {entry.result.summary.length !== 1 ? "s" : ""}
                  </div>
                  <div
                    style={{
                      fontSize: "0.84rem",
                      color: "var(--text-1)",
                      fontWeight: 500,
                      lineHeight: 1.45,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {entry.yamlPreview}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-2xl)", overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
        <div style={{ padding: "0.7rem 1.2rem", borderBottom: "1px solid var(--border)", background: "var(--surface-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.65rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Suite</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-1)", letterSpacing: "-0.02em" }}>Eval configuration (YAML)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {enabled.length === 0 && (
              <span style={{ fontSize: "0.78rem", color: "var(--text-3)", fontWeight: 500 }}>Enable models in Settings</span>
            )}
            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              style={{
                padding: "0.5rem 1.2rem",
                borderRadius: "var(--r-md)",
                border: "none",
                background: canRun ? "var(--accent)" : "var(--surface-hover)",
                color: canRun ? "#fff" : "var(--text-3)",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: canRun ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                boxShadow: canRun ? "0 2px 8px rgba(30, 64, 175, 0.28)" : "none",
                transition: "background 0.15s",
              }}
            >
              {loading ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Running…
                </>
              ) : "Run Suite"}
            </button>
          </div>
        </div>
        <textarea
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          spellCheck={false}
          style={{
            display: "block",
            width: "100%",
            minHeight: 280,
            background: "var(--surface-muted)",
            border: "none",
            outline: "none",
            color: "var(--text-1)",
            fontSize: "0.8125rem",
            lineHeight: 1.65,
            padding: "1.1rem 1.25rem",
            resize: "vertical",
            fontFamily: "var(--font-mono)",
            boxSizing: "border-box",
          }}
        />
      </div>

      {error && (
        <div style={{ background: "var(--red-subtle)", border: "1px solid rgba(185, 28, 28, 0.2)", color: "var(--red)", borderRadius: "var(--r-lg)", padding: "0.85rem 1.1rem", fontSize: "0.875rem", lineHeight: 1.55, fontWeight: 500 }}>
          {error}
        </div>
      )}

      {loading && (
        <div
          style={{
            background: "var(--accent-subtle)",
            border: "1px solid rgba(30, 64, 175, 0.15)",
            borderRadius: "var(--r-lg)",
            padding: "0.85rem 1.1rem",
            fontSize: "0.8125rem",
            lineHeight: 1.55,
            color: "var(--accent-text)",
            fontWeight: 500,
          }}
        >
          Running suite — logs stream live below as each LLM and judge request starts and finishes.
        </div>
      )}

      {(loading || runLog.length > 0) && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              padding: "0.65rem 1.1rem",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface-subtle)",
              fontWeight: 600,
              fontSize: "0.8125rem",
              letterSpacing: "-0.01em",
              color: "var(--text-1)",
            }}
          >
            {loading ? "Live run log" : "Run log"}
          </div>
          <p
            style={{
              margin: 0,
              padding: "0.45rem 1.1rem 0",
              fontSize: "0.68rem",
              color: "var(--text-3)",
              lineHeight: 1.45,
            }}
          >
            Needs a Node server (not static HTML export). On Vercel, use the Node runtime and a long enough function
            timeout (this route sets maxDuration to 300s). If hosts buffer SSE, disable buffering or run very long suites
            on a dedicated server.
          </p>
          <pre
            ref={logPreRef}
            style={{
              margin: 0,
              padding: "0.85rem 1.1rem",
              maxHeight: 280,
              overflow: "auto",
              fontSize: "0.72rem",
              lineHeight: 1.55,
              fontFamily: "var(--font-mono)",
              color: "var(--text-2)",
              background: "var(--surface-muted)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {runLog.length > 0 ? runLog.join("\n") : loading ? "Connecting…" : ""}
          </pre>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {judgeMeta && <JudgeRunSummary meta={judgeMeta} />}

          {/* Status banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            padding: "0.85rem 1.15rem", borderRadius: "var(--r-lg)",
            background: allPassed ? "var(--green-subtle)" : "var(--red-subtle)",
            border: `1px solid ${allPassed ? "rgba(4, 120, 87, 0.2)" : "rgba(185, 28, 28, 0.2)"}`,
          }}>
            <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>{allPassed ? "✓" : "✗"}</span>
            <span style={{ fontWeight: 600, color: allPassed ? "var(--green)" : "var(--red)", fontSize: "0.9rem" }}>
              {allPassed
                ? "All assertions passed"
                : `${result.summary.reduce((s, p) => s + p.failed, 0)} assertion(s) failed`}
            </span>
            <span style={{ color: "var(--text-3)", fontSize: "0.78rem", marginLeft: "auto" }}>
              {result.cases.length} test case{result.cases.length !== 1 ? "s" : ""} · {result.summary.length} provider{result.summary.length !== 1 ? "s" : ""}
            </span>
          </div>

          <SummaryTable summary={result.summary} />
          <ResultsTable cases={result.cases} summary={result.summary} />
        </div>
      )}

      {/* Empty state */}
      {!result && !error && !loading && (
        <div style={{ textAlign: "center", padding: "2.25rem 1rem", color: "var(--text-2)", fontSize: "0.875rem", lineHeight: 1.65, maxWidth: 440, margin: "0 auto" }}>
          Define prompts and assertions in YAML, then run against your enabled models. Expand rows in the results table to inspect outputs and rubric checks.
        </div>
      )}
    </div>
  );
}
