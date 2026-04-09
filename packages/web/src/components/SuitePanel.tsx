"use client";

import React, { useState } from "react";
import type { SuiteResult, TestCaseResult, ProviderSummary, AssertionResult } from "@llm-diff/core";
import type { LLMInstance } from "../types";
import { formatCost } from "@llm-diff/core";

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
      borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)",
    }}>
      <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-2)" }}>
        Provider Summary
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

function ResultsTable({ cases, summary }: { cases: TestCaseResult[]; summary: ProviderSummary[] }) {
  const [expandedCase, setExpandedCase] = useState<number | null>(null);
  const providerKeys = summary.map((s) => `${s.provider}/${s.model}`);

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)",
    }}>
      <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-2)" }}>
        Test Cases
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
                                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginTop: "0.25rem", paddingTop: "0.25rem", borderTop: "1px solid var(--border)" }}>
                                        {pr.assertions.map((a, ai) => <AssertionChip key={ai} a={a} />)}
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

// ─── Main SuitePanel ──────────────────────────────────────────────────────────

interface SuitePanelProps {
  instances: LLMInstance[];
}

export function SuitePanel({ instances }: SuitePanelProps) {
  const [yaml, setYaml] = useState(EXAMPLE_YAML);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = instances.filter((i) => i.enabled);
  const canRun = enabled.length > 0 && yaml.trim().length > 0 && !loading;

  const run = async () => {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/suite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml, instances }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }
      setResult(await res.json() as SuiteResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const allPassed = result ? result.summary.every((s) => s.failed === 0) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* YAML editor */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ padding: "0.65rem 1.1rem", borderBottom: "1px solid var(--border)", background: "var(--surface-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-2)" }}>Suite Config (YAML)</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {enabled.length === 0 && (
              <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Configure models first</span>
            )}
            <button
              onClick={run}
              disabled={!canRun}
              style={{
                padding: "0.45rem 1.1rem", borderRadius: "var(--r-sm)", border: "none",
                background: canRun ? "var(--accent)" : "var(--surface-hover)",
                color: canRun ? "#fff" : "var(--text-3)",
                fontWeight: 600, fontSize: "0.82rem", cursor: canRun ? "pointer" : "not-allowed",
                fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.4rem",
                boxShadow: canRun ? "0 1px 4px rgba(85,70,240,0.3)" : "none",
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
            display: "block", width: "100%", minHeight: 260,
            background: "transparent", border: "none", outline: "none",
            color: "var(--text-1)", fontSize: "0.82rem", lineHeight: 1.6,
            padding: "1rem 1.25rem", resize: "vertical",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "var(--red-subtle)", border: "1px solid var(--red)30", color: "var(--red)", borderRadius: "var(--r-md)", padding: "0.75rem 1rem", fontSize: "0.875rem", lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Status banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            padding: "0.75rem 1.1rem", borderRadius: "var(--r-md)",
            background: allPassed ? "var(--green-subtle, #f0fdf4)" : "var(--red-subtle)",
            border: `1px solid ${allPassed ? "var(--green)30" : "var(--red)30"}`,
          }}>
            <span style={{ fontSize: "1rem" }}>{allPassed ? "✓" : "✗"}</span>
            <span style={{ fontWeight: 600, color: allPassed ? "var(--green)" : "var(--red)", fontSize: "0.875rem" }}>
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
        <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-3)", fontSize: "0.875rem" }}>
          Edit the YAML above, configure your models, then hit Run Suite.
          <br />
          Click any row in the results table to see per-provider outputs and assertion details.
        </div>
      )}
    </div>
  );
}
