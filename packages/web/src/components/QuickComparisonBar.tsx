"use client";

import type { ReactNode } from "react";
import type { WebProviderResult } from "../types";
import { formatCost } from "@llm-diff/core";

function MiniChart({
  label,
  labelIcon,
  results,
  getValue,
  format,
  lowerIsBetter,
  barColor,
}: {
  label: string;
  labelIcon?: ReactNode;
  results: WebProviderResult[];
  getValue: (r: WebProviderResult) => number;
  format: (v: number) => string;
  lowerIsBetter?: boolean;
  barColor: string;
}) {
  const values = results.map(getValue);
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1e-9);

  return (
    <div style={{ flex: "1 1 140px", minWidth: 120 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          marginBottom: "0.4rem",
        }}
      >
        {labelIcon}
        <div
          style={{
            fontSize: "0.65rem",
            fontWeight: 600,
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.35rem", height: 52 }}>
        {results.map((r) => {
          const v = getValue(r);
          const t = lowerIsBetter ? (max - v) / span : (v - min) / span;
          const h = 8 + Math.round(t * 44);
          return (
            <div
              key={r.instanceId}
              title={`${r.label}: ${format(v)}`}
              style={{
                flex: 1,
                minWidth: 6,
                maxWidth: 28,
                height: h,
                borderRadius: 4,
                background: r.error ? "var(--border-strong)" : barColor,
                opacity: r.error ? 0.35 : 0.92,
                transition: "height 0.25s ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function QuickComparisonBar({
  results,
  onFullCompare,
}: {
  results: WebProviderResult[];
  onFullCompare: () => void;
}) {
  if (results.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        boxShadow: "0 -6px 24px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0.65rem 1.5rem 0.75rem",
          display: "flex",
          alignItems: "stretch",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "var(--text-2)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            paddingTop: "0.35rem",
            flexShrink: 0,
          }}
        >
          Quick comparison
        </div>
        <div style={{ display: "flex", flex: 1, gap: "1.25rem", flexWrap: "wrap", minWidth: 0 }}>
          <MiniChart
            label="Latency (ms)"
            labelIcon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--chart-latency)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            }
            results={results}
            getValue={(r) => (r.error ? 0 : r.latencyMs)}
            format={(v) => `${Math.round(v)}ms`}
            lowerIsBetter
            barColor="var(--chart-latency)"
          />
          <MiniChart
            label="Output tokens"
            results={results}
            getValue={(r) => (r.error ? 0 : r.outputTokens)}
            format={(v) => `${Math.round(v)}`}
            barColor="var(--chart-tokens)"
          />
          <MiniChart
            label="Cost"
            results={results}
            getValue={(r) => (r.error ? 0 : r.costUsd)}
            format={(v) => (v === 0 ? "$0" : formatCost(v))}
            lowerIsBetter
            barColor="var(--chart-cost)"
          />
        </div>
        <button
          type="button"
          onClick={onFullCompare}
          style={{
            alignSelf: "center",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.5rem 1rem",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-1)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "var(--shadow-xs)",
            flexShrink: 0,
          }}
        >
          Full compare
          <span style={{ fontSize: "0.95rem", lineHeight: 1, color: "var(--text-2)" }} aria-hidden>
            ↗
          </span>
        </button>
      </div>
    </div>
  );
}
