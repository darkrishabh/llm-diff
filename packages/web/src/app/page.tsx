"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo } from "react";
import type { JudgeSettings, LLMInstance, SecretsMap, WebDiffResult, WebProviderResult } from "../types";
import { DEFAULT_JUDGE_SETTINGS } from "../types";
import {
  loadInstances,
  saveInstances,
  loadSecrets,
  saveSecrets,
  loadJudgeSettings,
  saveJudgeSettings,
} from "../lib/storage";
import { BRAND_NAME, BRAND_TAGLINE } from "../lib/brand";
import { LlmDiffLogo } from "../components/LlmDiffLogo";
import { MODEL_CHIP_PALETTE } from "../lib/model-chip-palette";
import { resolveInstancesForApi } from "../lib/resolve-credentials";
import { SettingsPanel } from "../components/SettingsPanel";
import { ComparePanel } from "../components/ComparePanel";
import { ModelResponseCard } from "../components/ModelResponseCard";
import { QuickComparisonBar } from "../components/QuickComparisonBar";
import { ResponsesLineDiff } from "../components/ResponsesLineDiff";
import { appendRunHistory, loadRunHistory } from "../lib/run-history";
import type { RunHistoryEntry } from "../lib/run-history";

const RATINGS_KEY = "llm-diff:response-ratings";

type MainTab = "responses" | "compare" | "history";
type ResponsesView = "grid" | "sideBySide" | "diff";

function ratingKey(ranAt: string, instanceId: string) {
  return `${ranAt}|${instanceId}`;
}

type BadgeVariant = "good" | "warn" | "muted";

function computeCardHighlights(
  results: WebProviderResult[],
  ratings: Record<string, number>,
  runAt: string
): {
  badgeById: Map<string, { label: string; variant: BadgeVariant }>;
  latencyTone: (r: WebProviderResult) => "fast" | "slow" | "neutral";
} {
  const valid = results.filter((r) => !r.error && r.output.length > 0);
  const rk = (id: string) => ratingKey(runAt, id);

  const latency = valid.map((r) => r.latencyMs);
  const maxL = latency.length ? Math.max(...latency) : 0;
  const minL = latency.length ? Math.min(...latency) : 0;
  const costs = valid.map((r) => r.costUsd);
  const minC = costs.length ? Math.min(...costs) : 0;

  let bestStar = 0;
  for (const r of valid) {
    bestStar = Math.max(bestStar, ratings[rk(r.instanceId)] ?? 0);
  }

  const badgeById = new Map<string, { label: string; variant: BadgeVariant }>();

  for (const r of valid) {
    const key = rk(r.instanceId);
    const opts: { label: string; variant: BadgeVariant; priority: number }[] = [];
    if (bestStar > 0 && (ratings[key] ?? 0) === bestStar) {
      opts.push({ label: "best rated", variant: "muted", priority: 4 });
    }
    if (valid.length > 1 && r.latencyMs === minL && minL !== maxL) {
      opts.push({ label: "fastest", variant: "good", priority: 3 });
    }
    if (r.costUsd === minC) {
      opts.push({ label: "cheapest", variant: "muted", priority: 2 });
    }
    if (valid.length > 1 && r.latencyMs === maxL && minL !== maxL) {
      opts.push({ label: "slowest", variant: "warn", priority: 1 });
    }
    opts.sort((a, b) => b.priority - a.priority);
    if (opts[0]) badgeById.set(r.instanceId, { label: opts[0].label, variant: opts[0].variant });
  }

  const latencyTone = (r: WebProviderResult): "fast" | "slow" | "neutral" => {
    if (r.error || valid.length < 2) return "neutral";
    if (r.latencyMs === minL && minL !== maxL) return "fast";
    if (r.latencyMs === maxL && minL !== maxL) return "slow";
    return "neutral";
  };

  return { badgeById, latencyTone };
}

function TabBar({
  active,
  onChange,
}: {
  active: MainTab;
  onChange: (t: MainTab) => void;
}) {
  const tabs: { id: MainTab; label: string }[] = [
    { id: "responses", label: "Responses" },
    { id: "compare", label: "Compare & evaluate" },
    { id: "history", label: "History" },
  ];

  return (
    <nav
      style={{
        display: "flex",
        gap: "0.15rem",
        borderBottom: "1px solid var(--border)",
        paddingBottom: 0,
        width: "100%",
        maxWidth: "100%",
        overflowX: "auto",
      }}
      aria-label="Main"
    >
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              padding: "0.55rem 0.2rem",
              marginRight: "1.35rem",
              marginBottom: -1,
              border: "none",
              borderBottom: on ? "2px solid var(--text-1)" : "2px solid transparent",
              background: "transparent",
              color: on ? "var(--text-1)" : "var(--text-3)",
              fontWeight: on ? 600 : 500,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ResponsesView;
  onChange: (v: ResponsesView) => void;
}) {
  const opts: { id: ResponsesView; label: string }[] = [
    { id: "grid", label: "Grid" },
    { id: "sideBySide", label: "Side-by-side" },
    { id: "diff", label: "Diff" },
  ];
  return (
    <div
      role="group"
      aria-label="Response layout"
      style={{
        display: "inline-flex",
        padding: 4,
        borderRadius: 12,
        background: "var(--surface-muted)",
        border: "1px solid var(--border)",
        gap: 3,
      }}
    >
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: 9,
              border: "none",
              background: on ? "var(--surface)" : "transparent",
              color: on ? "var(--text-1)" : "var(--text-3)",
              fontWeight: on ? 600 : 500,
              fontSize: "0.78rem",
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: on ? "var(--shadow-xs)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [instances, setInstances] = useState<LLMInstance[]>([]);
  const [secrets, setSecrets] = useState<SecretsMap>({});
  const [judge, setJudge] = useState<JudgeSettings>(DEFAULT_JUDGE_SETTINGS);
  const [configOpen, setConfigOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebDiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<MainTab>("responses");
  const [responsesView, setResponsesView] = useState<ResponsesView>("grid");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [diffLeftId, setDiffLeftId] = useState("");
  const [diffRightId, setDiffRightId] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const appendedHistoryForRun = useRef<string | null>(null);

  useEffect(() => {
    setInstances(loadInstances());
    setSecrets(loadSecrets());
    setJudge(loadJudgeSettings());
    try {
      const raw = sessionStorage.getItem(RATINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        if (parsed && typeof parsed === "object") setRatings(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!result?.results.length) return;
    const ok = result.results.filter((r) => !r.error && r.output.trim());
    if (ok.length >= 2) {
      setDiffLeftId(ok[0].instanceId);
      setDiffRightId(ok[1].instanceId);
    } else if (ok.length === 1) {
      setDiffLeftId(ok[0].instanceId);
      setDiffRightId(ok[0].instanceId);
    }
  }, [result?.ranAt]);

  useEffect(() => {
    if (!result) return;
    if (appendedHistoryForRun.current === result.ranAt) return;
    appendedHistoryForRun.current = result.ranAt;
    appendRunHistory(result);
    setHistoryVersion((v) => v + 1);
  }, [result]);

  const historyEntries = useMemo(() => loadRunHistory(), [historyVersion]);

  const persistRating = (next: Record<string, number>) => {
    try {
      sessionStorage.setItem(RATINGS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const setStarRating = (runAt: string, instanceId: string, stars: number) => {
    const k = ratingKey(runAt, instanceId);
    setRatings((prev) => {
      const out = { ...prev };
      if (stars <= 0) delete out[k];
      else out[k] = stars;
      persistRating(out);
      return out;
    });
  };

  const updateInstances = (next: LLMInstance[]) => {
    setInstances(next);
    saveInstances(next);
  };

  const updateSecrets = (next: SecretsMap) => {
    setSecrets(next);
    saveSecrets(next);
  };

  const updateJudge = (next: JudgeSettings) => {
    setJudge(next);
    saveJudgeSettings(next);
  };

  const enabled = instances.filter((i) => i.enabled);

  const newRun = () => {
    setResult(null);
    setError(null);
    setTab("responses");
    setResponsesView("grid");
  };

  const restoreHistoryEntry = (entry: RunHistoryEntry) => {
    setResult(entry.result);
    setPrompt(entry.result.prompt);
    setTab("responses");
    setResponsesView("grid");
    appendedHistoryForRun.current = entry.result.ranAt;
  };

  const run = async () => {
    if (!prompt.trim() || enabled.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setTab("responses");
    setResponsesView("grid");
    try {
      const res = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          instances: resolveInstancesForApi(instances, secrets),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const highlights = result
    ? computeCardHighlights(result.results, ratings, result.ranAt)
    : null;

  const wallClockSec = useMemo(() => {
    if (!result) return 0;
    const ms = result.results.filter((r) => !r.error).map((r) => r.latencyMs);
    if (!ms.length) return 0;
    return Math.max(...ms) / 1000;
  }, [result]);

  const showQuickBar = Boolean(result && tab === "responses");
  const mainPadBottom = showQuickBar ? "5.5rem" : "3rem";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-gradient)" }}>
      <header
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 30,
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "0 1.5rem",
            minHeight: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", minWidth: 0 }}>
            <LlmDiffLogo size={30} />
            <span
              style={{
                fontWeight: 700,
                fontSize: "1.05rem",
                letterSpacing: "-0.03em",
                color: "var(--text-1)",
              }}
            >
              {BRAND_NAME}
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                color: "var(--text-3)",
                letterSpacing: "0.04em",
              }}
            >
              v0.1
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link
              href="/suite"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--text-2)",
                textDecoration: "none",
                padding: "0.45rem 0.85rem",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                boxShadow: "var(--shadow-xs)",
                transition: "background 0.15s, border-color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              Test suites
            </Link>
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "0.8125rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontFamily: "inherit",
                transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
                boxShadow: "var(--shadow-xs)",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-hover)";
                e.currentTarget.style.borderColor = "var(--border-strong)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Settings
              {enabled.length > 0 && (
                <span
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    borderRadius: 999,
                    minWidth: 22,
                    height: 22,
                    padding: "0 6px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {enabled.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={newRun}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "var(--r-md)",
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.8125rem",
                fontWeight: 600,
                fontFamily: "inherit",
                boxShadow: "0 1px 3px rgba(37, 99, 235, 0.35)",
                whiteSpace: "nowrap",
              }}
            >
              + New run
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: `1.75rem 1.5rem ${mainPadBottom}` }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2xl)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ padding: "0.7rem 1.25rem 0.35rem", background: "var(--surface)" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Prompt
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            placeholder="Ask a question, paste code to review, or describe a task…"
            rows={5}
            style={{
              display: "block",
              width: "100%",
              background: "var(--surface)",
              border: "none",
              color: "var(--text-1)",
              fontSize: "0.97rem",
              lineHeight: 1.65,
              padding: "0.35rem 1.25rem 1.15rem",
              minHeight: 140,
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
            }}
          />

          <div
            style={{
              padding: "0.7rem 1.15rem",
              borderTop: "1px solid var(--border)",
              background: "var(--surface-muted)",
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "0.35rem", flex: 1, flexWrap: "wrap", alignItems: "center" }}>
              {enabled.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setConfigOpen(true)}
                  style={{
                    background: "var(--surface)",
                    border: "1px dashed var(--border-strong)",
                    color: "var(--text-2)",
                    borderRadius: 8,
                    padding: "0.35rem 0.85rem",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                >
                  + Add models in Settings
                </button>
              ) : (
                enabled.map((i, chipIdx) => {
                  const dot = MODEL_CHIP_PALETTE[chipIdx % MODEL_CHIP_PALETTE.length];
                  return (
                    <span
                      key={i.id}
                      title={`${i.provider} · ${i.model}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.32rem 0.7rem",
                        borderRadius: 999,
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--text-1)",
                        whiteSpace: "nowrap",
                        boxShadow: "var(--shadow-xs)",
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: dot,
                          flexShrink: 0,
                        }}
                        aria-hidden
                      />
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.72rem" }}>{i.model}</span>
                    </span>
                  );
                })
              )}
              <button
                type="button"
                onClick={() => setConfigOpen(true)}
                style={{
                  background: "var(--surface)",
                  border: "1px dashed var(--border-strong)",
                  color: "var(--text-2)",
                  borderRadius: 8,
                  padding: "0.28rem 0.65rem",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + add model
              </button>
            </div>

            <button
              type="button"
              onClick={run}
              disabled={loading || !prompt.trim() || enabled.length === 0}
              style={{
                padding: "0.55rem 1.35rem",
                borderRadius: "var(--r-md)",
                border: "none",
                background:
                  loading || !prompt.trim() || enabled.length === 0
                    ? "var(--surface-hover)"
                    : "var(--accent)",
                color:
                  loading || !prompt.trim() || enabled.length === 0
                    ? "var(--text-3)"
                    : "#fff",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor:
                  loading || !prompt.trim() || enabled.length === 0
                    ? "not-allowed"
                    : "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s, box-shadow 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                whiteSpace: "nowrap",
                boxShadow:
                  !loading && prompt.trim() && enabled.length > 0
                    ? "0 2px 10px rgba(37, 99, 235, 0.28)"
                    : "none",
              }}
              onMouseEnter={(e) => {
                if (!loading && prompt.trim() && enabled.length > 0) {
                  e.currentTarget.style.background = "var(--accent-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && prompt.trim() && enabled.length > 0) {
                  e.currentTarget.style.background = "var(--accent)";
                }
              }}
            >
              {loading ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Running…
                </>
              ) : (
                <>Run <kbd style={{ fontSize: "0.68rem", opacity: 0.8, fontFamily: "inherit" }}>⌘↵</kbd></>
              )}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <TabBar active={tab} onChange={setTab} />
        </div>

        {error && (
          <div
            style={{
              background: "var(--red-subtle)",
              border: "1px solid rgba(185, 28, 28, 0.2)",
              color: "var(--red)",
              borderRadius: "var(--r-lg)",
              padding: "0.85rem 1.1rem",
              fontSize: "0.875rem",
              marginBottom: "1.35rem",
              lineHeight: 1.55,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {tab === "history" && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)",
              boxShadow: "var(--shadow-md)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Recent runs
              </span>
            </div>
            {historyEntries.length === 0 ? (
              <div style={{ padding: "2.5rem 1.25rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
                No runs yet. Execute a prompt to build history (stored in this browser).
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {historyEntries.map((entry) => (
                  <li key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <button
                      type="button"
                      onClick={() => restoreHistoryEntry(entry)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.85rem 1.15rem",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "block",
                      }}
                    >
                      <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginBottom: "0.25rem" }}>
                        {new Date(entry.ranAt).toLocaleString()} · {entry.result.results.length} model
                        {entry.result.results.length !== 1 ? "s" : ""}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "var(--text-1)", fontWeight: 500, lineHeight: 1.45 }}>
                        {entry.promptPreview}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "compare" && !result && (
          <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-3)", fontSize: "0.875rem" }}>
            Run a prompt to open the full compare &amp; evaluate panel.
          </div>
        )}

        {result && tab === "compare" && <ComparePanel results={result.results} />}

        {result && tab === "responses" && (
          <div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                marginBottom: "1.1rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-2)",
                  fontWeight: 500,
                  padding: "0.35rem 0.75rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                {result.results.filter((r) => !r.error).length}/{result.results.length} succeeded
                <span style={{ color: "var(--text-3)", margin: "0 0.5rem" }}>·</span>
                {new Date(result.ranAt).toLocaleTimeString()}
                {wallClockSec > 0 && (
                  <>
                    <span style={{ color: "var(--text-3)", margin: "0 0.5rem" }}>·</span>
                    {wallClockSec < 10 ? wallClockSec.toFixed(1) : Math.round(wallClockSec)}
                    s total
                  </>
                )}
              </span>
              <ViewToggle value={responsesView} onChange={setResponsesView} />
            </div>

            {responsesView === "grid" && highlights && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 500px), 1fr))",
                  gap: "1.15rem",
                  alignItems: "stretch",
                }}
              >
                {result.results.map((r) => (
                  <ModelResponseCard
                    key={r.instanceId}
                    r={r}
                    badge={highlights.badgeById.get(r.instanceId) ?? null}
                    latencyTone={highlights.latencyTone(r)}
                    rating={ratings[ratingKey(result.ranAt, r.instanceId)] ?? 0}
                    onRate={(n) => setStarRating(result.ranAt, r.instanceId, n)}
                  />
                ))}
              </div>
            )}

            {responsesView === "sideBySide" && highlights && (
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  overflowX: "auto",
                  paddingBottom: "0.35rem",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {result.results.map((r) => (
                  <div
                    key={r.instanceId}
                    style={{
                      flex: "0 0 min(420px, 85vw)",
                      minWidth: "min(420px, 85vw)",
                      maxWidth: "100%",
                    }}
                  >
                    <ModelResponseCard
                      r={r}
                      badge={highlights.badgeById.get(r.instanceId) ?? null}
                      latencyTone={highlights.latencyTone(r)}
                      rating={ratings[ratingKey(result.ranAt, r.instanceId)] ?? 0}
                      onRate={(n) => setStarRating(result.ranAt, r.instanceId, n)}
                    />
                  </div>
                ))}
              </div>
            )}

            {responsesView === "diff" && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-xl)",
                  padding: "1.15rem 1.25rem",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <ResponsesLineDiff
                  results={result.results}
                  leftId={diffLeftId}
                  rightId={diffRightId}
                  onLeftId={setDiffLeftId}
                  onRightId={setDiffRightId}
                />
              </div>
            )}
          </div>
        )}

        {!result && !error && !loading && tab !== "history" && (
          <div
            style={{
              textAlign: "center",
              padding: "3.5rem 1.5rem 4rem",
              color: "var(--text-3)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 1.25rem",
                borderRadius: "var(--r-lg)",
                background: "var(--accent-subtle)",
                border: "1px solid rgba(30, 64, 175, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-1)", marginBottom: "0.35rem", letterSpacing: "-0.02em" }}>
              Ready when you are
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-3)", maxWidth: 420, margin: "0 auto 0.75rem", lineHeight: 1.5 }}>
              {BRAND_TAGLINE}
            </p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-2)", maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
              Add models under Settings, enter a prompt, then run. Use Grid, Side-by-side, or Diff on the Responses tab, and open History to reload past runs.
            </p>
          </div>
        )}
      </main>

      {showQuickBar && result && (
        <QuickComparisonBar results={result.results} onFullCompare={() => setTab("compare")} />
      )}

      {configOpen && (
        <SettingsPanel
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          instances={instances}
          onUpdateInstances={updateInstances}
          secrets={secrets}
          onUpdateSecrets={updateSecrets}
          judge={judge}
          onUpdateJudge={updateJudge}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-3); }
        textarea::placeholder { color: var(--text-3); }
      `}</style>
    </div>
  );
}
