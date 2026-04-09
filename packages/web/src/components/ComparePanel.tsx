"use client";

import React from "react";
import type { WebProviderResult } from "../types";
import { formatCost } from "@llm-diff/core";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function tokensPerSec(tokens: number, latencyMs: number) {
  return latencyMs > 0 ? Math.round((tokens / latencyMs) * 1000) : 0;
}

const STOP_WORDS = new Set([
  "the","and","for","are","but","not","you","all","can","had","her","was",
  "one","our","out","day","get","has","him","his","how","its","may","new",
  "now","old","see","two","way","who","any","use","this","that","with","have",
  "from","they","know","want","been","good","much","some","time","very","when",
  "come","here","just","like","long","make","many","more","only","over","such",
  "take","than","them","well","were","what","your","into","there","their","will",
  "also","each","which","would","could","should","other","after","about","these",
  "those","being","because","through","between","during","before","without",
]);

function tokenise(text: string): string[] {
  return (text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? []).filter(
    (w) => !STOP_WORDS.has(w)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenise(a));
  const setB = new Set(tokenise(b));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function uniqueTerms(text: string, others: string[], n = 8): string[] {
  const freq = new Map<string, number>();
  tokenise(text).forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
  const otherWords = new Set(others.flatMap(tokenise));
  return [...freq.entries()]
    .filter(([w]) => !otherWords.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

function countStructure(text: string) {
  return {
    headings: (text.match(/^#{1,6} /gm) ?? []).length,
    bullets: (text.match(/^[-*] /gm) ?? []).length,
    codeBlocks: (text.match(/```/g) ?? []).length / 2,
    tables: (text.match(/^\|.+\|/gm) ?? []).length > 0,
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PROVIDER_COLOR: Record<string, string> = {
  claude:      "var(--claude)",
  ollama:      "var(--ollama)",
  minimax:     "var(--minimax)",
  openai:      "var(--openai)",
  groq:        "var(--groq)",
  openrouter:  "var(--openrouter)",
  "nvidia-nim":"var(--nvidia-nim)",
  together:    "var(--together)",
  perplexity:  "var(--perplexity)",
  custom:      "var(--custom)",
};

const PROVIDER_SUBTLE: Record<string, string> = {
  claude:      "var(--claude-subtle)",
  ollama:      "var(--ollama-subtle)",
  minimax:     "var(--minimax-subtle)",
  openai:      "var(--openai-subtle)",
  groq:        "var(--groq-subtle)",
  openrouter:  "var(--openrouter-subtle)",
  "nvidia-nim":"var(--nvidia-nim-subtle)",
  together:    "var(--together-subtle)",
  perplexity:  "var(--perplexity-subtle)",
  custom:      "var(--custom-subtle)",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div
        style={{
          padding: "0.875rem 1.25rem",
          borderBottom: "1px solid var(--border)",
          fontWeight: 600,
          fontSize: "0.82rem",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-2)",
        }}
      >
        {title}
      </div>
      <div style={{ padding: "1.25rem" }}>{children}</div>
    </div>
  );
}

function WinnerCard({
  icon,
  label,
  winner,
  value,
  color,
}: {
  icon: string;
  label: string;
  winner: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderTop: `3px solid ${color}`,
        borderRadius: "var(--r-md)",
        padding: "1rem 1.1rem",
        boxShadow: "var(--shadow-xs)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-3)",
          marginBottom: "0.35rem",
        }}
      >
        {icon} {label}
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: "0.95rem",
          color: "var(--text-1)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginBottom: "0.2rem",
        }}
      >
        {winner}
      </div>
      <div style={{ fontSize: "0.8rem", color, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function MetricRow({
  label,
  results,
  getValue,
  format,
  lowerIsBetter,
}: {
  label: string;
  results: WebProviderResult[];
  getValue: (r: WebProviderResult) => number;
  format: (v: number) => string;
  lowerIsBetter?: boolean;
}) {
  const values = results.map(getValue);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const winnerIdx = lowerIsBetter
    ? values.indexOf(min)
    : values.indexOf(max);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      {results.map((r, i) => {
        const v = getValue(r);
        const pct = max > 0 ? (v / max) * 100 : 0;
        const barPct = lowerIsBetter && max > 0 ? (v / max) * 100 : pct;
        const barColor =
          i === winnerIdx
            ? PROVIDER_COLOR[r.provider] ?? "var(--accent)"
            : "var(--border-strong)";
        const isWinner = i === winnerIdx;

        return (
          <div key={r.instanceId} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 130,
                fontSize: "0.78rem",
                color: "var(--text-2)",
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={r.label}
            >
              {r.label}
            </div>
            <div
              style={{
                flex: 1,
                height: 8,
                background: "var(--surface-subtle)",
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: `${barPct}%`,
                  height: "100%",
                  background: barColor,
                  borderRadius: 4,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: isWinner ? 600 : 400,
                color: isWinner
                  ? PROVIDER_COLOR[r.provider] ?? "var(--accent)"
                  : "var(--text-2)",
                width: 90,
                textAlign: "right",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "0.3rem",
              }}
            >
              {format(v)}
              {isWinner && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    background: PROVIDER_SUBTLE[r.provider] ?? "var(--accent-subtle)",
                    color: PROVIDER_COLOR[r.provider] ?? "var(--accent)",
                    border: `1px solid ${PROVIDER_COLOR[r.provider] ?? "var(--accent)"}40`,
                    borderRadius: 4,
                    padding: "0.05rem 0.35rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {lowerIsBetter ? "best" : "most"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SimilarityPill({ pct }: { pct: number }) {
  const color =
    pct > 0.65 ? "var(--green)" : pct > 0.4 ? "var(--amber)" : "var(--text-3)";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        background: "var(--surface-subtle)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "0.5rem 0.75rem",
        width: "100%",
      }}
    >
      <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: "0.82rem", fontWeight: 700, color, width: 36, textAlign: "right", flexShrink: 0 }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

function TermChip({ term, color }: { term: string; color: string }) {
  return (
    <span
      style={{
        padding: "0.2rem 0.55rem",
        borderRadius: 5,
        fontSize: "0.75rem",
        background: color + "12",
        border: `1px solid ${color}28`,
        color,
        fontWeight: 500,
      }}
    >
      {term}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ComparePanel({ results }: { results: WebProviderResult[] }) {
  const valid = results.filter((r) => !r.error && r.output.length > 0);

  if (valid.length < 2) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem",
          color: "var(--text-3)",
          fontSize: "0.875rem",
        }}
      >
        Need at least 2 successful responses to compare.
      </div>
    );
  }

  // ── At a glance ──
  const fastest = valid.reduce((a, b) => (a.latencyMs < b.latencyMs ? a : b));
  const cheapest = valid.reduce((a, b) => (a.costUsd <= b.costUsd ? a : b));
  const mostDetailed = valid.reduce((a, b) =>
    wordCount(a.output) >= wordCount(b.output) ? a : b
  );
  const tokensPerSecValues = valid.map((r) => tokensPerSec(r.outputTokens, r.latencyMs));
  const fastestGenIdx = tokensPerSecValues.indexOf(Math.max(...tokensPerSecValues));
  const fastestGen = valid[fastestGenIdx];

  // ── Similarity pairs ──
  const pairs: { a: WebProviderResult; b: WebProviderResult; sim: number }[] = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      pairs.push({
        a: valid[i],
        b: valid[j],
        sim: jaccardSimilarity(valid[i].output, valid[j].output),
      });
    }
  }

  // ── Unique terms ──
  const uniqueByModel = valid.map((r) =>
    uniqueTerms(
      r.output,
      valid.filter((o) => o.instanceId !== r.instanceId).map((o) => o.output)
    )
  );

  // ── Structure ──
  const structures = valid.map((r) => countStructure(r.output));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* At a glance */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <WinnerCard
          icon="⚡"
          label="Fastest"
          winner={fastest.label}
          value={`${fastest.latencyMs.toLocaleString()}ms`}
          color={PROVIDER_COLOR[fastest.provider] ?? "var(--accent)"}
        />
        <WinnerCard
          icon="💰"
          label="Cheapest"
          winner={cheapest.label}
          value={cheapest.costUsd === 0 ? "Free (local)" : formatCost(cheapest.costUsd)}
          color={PROVIDER_COLOR[cheapest.provider] ?? "var(--accent)"}
        />
        <WinnerCard
          icon="📝"
          label="Most Detailed"
          winner={mostDetailed.label}
          value={`${wordCount(mostDetailed.output).toLocaleString()} words`}
          color={PROVIDER_COLOR[mostDetailed.provider] ?? "var(--accent)"}
        />
        {fastestGen && tokensPerSecValues[fastestGenIdx] > 0 && (
          <WinnerCard
            icon="🔥"
            label="Fastest Generation"
            winner={fastestGen.label}
            value={`${tokensPerSecValues[fastestGenIdx]} tok/s`}
            color={PROVIDER_COLOR[fastestGen.provider] ?? "var(--accent)"}
          />
        )}
      </div>

      {/* Performance metrics */}
      <Section title="Performance">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <MetricRow
            label="Latency"
            results={valid}
            getValue={(r) => r.latencyMs}
            format={(v) => `${v.toLocaleString()}ms`}
            lowerIsBetter
          />
          <MetricRow
            label="Cost"
            results={valid}
            getValue={(r) => r.costUsd}
            format={(v) => (v === 0 ? "$0.00" : formatCost(v))}
            lowerIsBetter
          />
          {valid.some((r) => r.outputTokens > 0) && (
            <MetricRow
              label="Generation Speed (tok/s)"
              results={valid}
              getValue={(r) => tokensPerSec(r.outputTokens, r.latencyMs)}
              format={(v) => (v > 0 ? `${v} tok/s` : "—")}
            />
          )}
        </div>
      </Section>

      {/* Output analysis */}
      <Section title="Output Analysis">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <MetricRow
            label="Word Count"
            results={valid}
            getValue={(r) => wordCount(r.output)}
            format={(v) => `${v.toLocaleString()} words`}
          />
          {valid.some((r) => r.outputTokens > 0) && (
            <MetricRow
              label="Output Tokens"
              results={valid}
              getValue={(r) => r.outputTokens}
              format={(v) => (v > 0 ? `${v.toLocaleString()} tokens` : "—")}
            />
          )}
        </div>

        {/* Structure signals */}
        <div
          style={{
            marginTop: "1.25rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--text-2)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "0.25rem",
            }}
          >
            Structure
          </div>
          {valid.map((r, i) => {
            const s = structures[i];
            const tags = [
              s.headings > 0 && `${s.headings} heading${s.headings > 1 ? "s" : ""}`,
              s.bullets > 0 && `${s.bullets} bullet${s.bullets > 1 ? "s" : ""}`,
              s.codeBlocks > 0 && `${Math.round(s.codeBlocks)} code block${s.codeBlocks > 1 ? "s" : ""}`,
              s.tables && "table",
            ].filter(Boolean);

            return (
              <div
                key={r.instanceId}
                style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
              >
                <div
                  style={{
                    width: 130,
                    fontSize: "0.78rem",
                    color: "var(--text-2)",
                    flexShrink: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.label}
                </div>
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  {tags.length > 0 ? (
                    tags.map((tag) => (
                      <span
                        key={String(tag)}
                        style={{
                          padding: "0.1rem 0.5rem",
                          borderRadius: 5,
                          fontSize: "0.75rem",
                          background: "var(--surface-subtle)",
                          border: "1px solid var(--border)",
                          color: "var(--text-2)",
                        }}
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                      plain prose
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Similarity */}
      {pairs.length > 0 && (
        <Section title="Similarity">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {pairs.map((p) => (
              <div
                key={`${p.a.instanceId}-${p.b.instanceId}`}
                style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
              >
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-2)",
                    flexShrink: 0,
                    width: 260,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ color: PROVIDER_COLOR[p.a.provider] ?? "inherit", fontWeight: 500 }}>
                    {p.a.label}
                  </span>
                  <span style={{ color: "var(--text-3)", margin: "0 0.35rem" }}>↔</span>
                  <span style={{ color: PROVIDER_COLOR[p.b.provider] ?? "inherit", fontWeight: 500 }}>
                    {p.b.label}
                  </span>
                </div>
                <SimilarityPill pct={p.sim} />
              </div>
            ))}
            <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
              Jaccard similarity on meaningful word overlap. &gt;65% = largely similar, &lt;40% = notably different.
            </p>
          </div>
        </Section>
      )}

      {/* Unique contributions */}
      {uniqueByModel.some((terms) => terms.length > 0) && (
        <Section title="Unique Contributions">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {valid.map((r, i) => {
              const terms = uniqueByModel[i];
              const color = PROVIDER_COLOR[r.provider] ?? "var(--accent)";
              return (
                <div key={r.instanceId} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-2)",
                      width: 130,
                      flexShrink: 0,
                      paddingTop: "0.15rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.label}
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", flex: 1 }}>
                    {terms.length > 0 ? (
                      terms.map((t) => <TermChip key={t} term={t} color={color} />)
                    ) : (
                      <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                        No notably unique terms
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
              Terms that appear in this model's response but not in others — indicating unique focus areas.
            </p>
          </div>
        </Section>
      )}
    </div>
  );
}
