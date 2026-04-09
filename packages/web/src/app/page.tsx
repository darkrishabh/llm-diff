"use client";

import { useState, useEffect, useRef } from "react";
import { formatCost } from "@llm-diff/core";
import type { LLMInstance, WebDiffResult, WebProviderResult } from "../types";
import { loadInstances, saveInstances } from "../lib/storage";
import { ConfigPanel } from "../components/ConfigPanel";
import { MarkdownOutput } from "../components/MarkdownOutput";
import { ComparePanel } from "../components/ComparePanel";

// ─── Provider theme ───────────────────────────────────────────────────────────

const PC: Record<string, { color: string; subtle: string; border: string }> = {
  claude:      { color: "var(--claude)",      subtle: "var(--claude-subtle)",      border: "var(--claude-border)"      },
  ollama:      { color: "var(--ollama)",      subtle: "var(--ollama-subtle)",      border: "var(--ollama-border)"      },
  minimax:     { color: "var(--minimax)",     subtle: "var(--minimax-subtle)",     border: "var(--minimax-border)"     },
  openai:      { color: "var(--openai)",      subtle: "var(--openai-subtle)",      border: "var(--openai-border)"      },
  groq:        { color: "var(--groq)",        subtle: "var(--groq-subtle)",        border: "var(--groq-border)"        },
  openrouter:  { color: "var(--openrouter)",  subtle: "var(--openrouter-subtle)",  border: "var(--openrouter-border)"  },
  "nvidia-nim":{ color: "var(--nvidia-nim)",  subtle: "var(--nvidia-nim-subtle)",  border: "var(--nvidia-nim-border)"  },
  together:    { color: "var(--together)",    subtle: "var(--together-subtle)",    border: "var(--together-border)"    },
  perplexity:  { color: "var(--perplexity)",  subtle: "var(--perplexity-subtle)",  border: "var(--perplexity-border)"  },
  custom:      { color: "var(--custom)",      subtle: "var(--custom-subtle)",      border: "var(--custom-border)"      },
};
const pColor  = (p: string) => PC[p]?.color  ?? "var(--text-3)";
const pSubtle = (p: string) => PC[p]?.subtle ?? "var(--surface-subtle)";
const pBorder = (p: string) => PC[p]?.border ?? "var(--border)";

// ─── Stat pill ────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
      <span style={{ color: "var(--text-3)", fontSize: "0.72rem" }}>{label}</span>
      <span style={{ color: "var(--text-2)", fontSize: "0.78rem", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── Response card ────────────────────────────────────────────────────────────

function ResponseCard({ r }: { r: WebProviderResult }) {
  const color  = pColor(r.provider);
  const subtle = pSubtle(r.provider);
  const border = pBorder(r.provider);
  const hasError = Boolean(r.error);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "0.875rem 1.1rem",
          borderBottom: `1px solid ${border}`,
          background: subtle,
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <span
          style={{
            padding: "0.15rem 0.55rem",
            borderRadius: 5,
            background: color + "18",
            border: `1px solid ${color}30`,
            color,
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            flexShrink: 0,
          }}
        >
          {r.provider}
        </span>
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--text-2)",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {r.model}
        </span>
        {hasError && (
          <span
            style={{
              fontSize: "0.68rem",
              color: "var(--red)",
              background: "var(--red-subtle)",
              border: "1px solid var(--red)30",
              borderRadius: 5,
              padding: "0.15rem 0.45rem",
              fontWeight: 600,
            }}
          >
            Error
          </span>
        )}
      </div>

      {/* Stats row */}
      {!hasError && (
        <div
          style={{
            padding: "0.5rem 1.1rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <Stat label="Latency" value={`${r.latencyMs.toLocaleString()}ms`} />
          {r.inputTokens > 0 || r.outputTokens > 0 ? (
            <Stat label="Tokens" value={`${r.inputTokens}→${r.outputTokens}`} />
          ) : null}
          <Stat label="Cost" value={r.costUsd === 0 ? "$0.00" : formatCost(r.costUsd)} />
        </div>
      )}

      {/* Output body */}
      <div
        style={{
          padding: "1.1rem",
          overflowY: "auto",
          maxHeight: 560,
          flex: 1,
        }}
      >
        {hasError ? (
          <div
            style={{
              color: "var(--red)",
              background: "var(--red-subtle)",
              border: "1px solid var(--red)25",
              borderRadius: "var(--r-sm)",
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
            }}
          >
            {r.error}
          </div>
        ) : (
          <MarkdownOutput content={r.output} />
        )}
      </div>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: "responses" | "compare";
  onChange: (t: "responses" | "compare") => void;
}) {
  const tabs: { id: "responses" | "compare"; label: string }[] = [
    { id: "responses", label: "Responses" },
    { id: "compare",   label: "Compare & Evaluate" },
  ];

  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "3px",
        gap: "2px",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "0.45rem 1rem",
            borderRadius: 7,
            border: "none",
            background: active === t.id ? "var(--accent)" : "transparent",
            color: active === t.id ? "#fff" : "var(--text-2)",
            fontWeight: active === t.id ? 600 : 400,
            fontSize: "0.82rem",
            cursor: "pointer",
            transition: "all 0.15s",
            fontFamily: "inherit",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [instances, setInstances] = useState<LLMInstance[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebDiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"responses" | "compare">("responses");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setInstances(loadInstances());
  }, []);

  const updateInstances = (next: LLMInstance[]) => {
    setInstances(next);
    saveInstances(next);
  };

  const enabled = instances.filter((i) => i.enabled);

  const run = async () => {
    if (!prompt.trim() || enabled.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setTab("responses");
    try {
      const res = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, instances }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Header ── */}
      <header
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 1.5rem",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                letterSpacing: "-0.02em",
                color: "var(--text-1)",
              }}
            >
              llm-diff
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                background: "var(--accent-subtle)",
                color: "var(--accent-text)",
                border: "1px solid var(--accent)25",
                borderRadius: 4,
                padding: "0.1rem 0.45rem",
                fontWeight: 600,
              }}
            >
              v0.1
            </span>
          </div>

          <button
            onClick={() => setConfigOpen(true)}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-2)",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              fontFamily: "inherit",
              transition: "all 0.15s",
              boxShadow: "var(--shadow-xs)",
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
            Configure
            {enabled.length > 0 && (
              <span
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "0 5px",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  lineHeight: "1.6",
                }}
              >
                {enabled.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* ── Prompt box ── */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
            marginBottom: "1.5rem",
          }}
        >
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            placeholder="Enter your prompt…"
            rows={4}
            style={{
              display: "block",
              width: "100%",
              background: "transparent",
              border: "none",
              color: "var(--text-1)",
              fontSize: "0.95rem",
              lineHeight: 1.65,
              padding: "1rem 1.25rem",
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
            }}
          />

          {/* Bottom bar */}
          <div
            style={{
              padding: "0.65rem 1.1rem",
              borderTop: "1px solid var(--border)",
              background: "var(--surface-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            {/* Model chips */}
            <div style={{ display: "flex", gap: "0.35rem", flex: 1, flexWrap: "wrap" }}>
              {enabled.length === 0 ? (
                <button
                  onClick={() => setConfigOpen(true)}
                  style={{
                    background: "none",
                    border: "1px dashed var(--border-strong)",
                    color: "var(--text-3)",
                    borderRadius: 6,
                    padding: "0.2rem 0.7rem",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  + Add a model
                </button>
              ) : (
                enabled.map((i) => (
                  <span
                    key={i.id}
                    style={{
                      padding: "0.18rem 0.6rem",
                      borderRadius: 5,
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      background: pSubtle(i.provider),
                      border: `1px solid ${pBorder(i.provider)}`,
                      color: pColor(i.provider),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {i.provider}/{i.model}
                  </span>
                ))
              )}
            </div>

            {/* Run button */}
            <button
              onClick={run}
              disabled={loading || !prompt.trim() || enabled.length === 0}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "var(--r-sm)",
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
                fontSize: "0.85rem",
                cursor:
                  loading || !prompt.trim() || enabled.length === 0
                    ? "not-allowed"
                    : "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                whiteSpace: "nowrap",
                boxShadow:
                  !loading && prompt.trim() && enabled.length > 0
                    ? "0 1px 4px rgba(85,70,240,0.3)"
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

        {/* ── Error ── */}
        {error && (
          <div
            style={{
              background: "var(--red-subtle)",
              border: "1px solid var(--red)30",
              color: "var(--red)",
              borderRadius: "var(--r-md)",
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              marginBottom: "1.25rem",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div>
            {/* Tab bar + meta */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <TabBar active={tab} onChange={setTab} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                {result.results.filter((r) => !r.error).length} of {result.results.length} succeeded
                &nbsp;·&nbsp;
                {new Date(result.ranAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Responses tab */}
            {tab === "responses" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.min(result.results.length, 3)}, minmax(0, 1fr))`,
                  gap: "1rem",
                }}
              >
                {result.results.map((r) => (
                  <ResponseCard key={r.instanceId} r={r} />
                ))}
              </div>
            )}

            {/* Compare tab */}
            {tab === "compare" && (
              <ComparePanel results={result.results} />
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!result && !error && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              color: "var(--text-3)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚡</div>
            <p style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-2)", marginBottom: "0.4rem" }}>
              Run a prompt to see results
            </p>
            <p style={{ fontSize: "0.8rem" }}>
              Configure your models above, then hit Run to compare responses side by side.
            </p>
          </div>
        )}
      </main>

      {/* Config drawer */}
      {configOpen && (
        <ConfigPanel
          instances={instances}
          onUpdate={updateInstances}
          onClose={() => setConfigOpen(false)}
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
