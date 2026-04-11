"use client";

import { useState } from "react";
import { formatCost } from "@bench/engine";
import type { WebProviderResult } from "../types";
import { MarkdownOutput } from "./MarkdownOutput";
import { formatProviderDisplayName, providerUi } from "../lib/provider-ui";

type BadgeVariant = "good" | "warn" | "muted";

function StarButton({
  n,
  active,
  onClick,
}: {
  n: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${n} star${n > 1 ? "s" : ""}`}
      style={{
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: "0.12rem",
        lineHeight: 0,
        color: active ? "var(--amber)" : "var(--text-3)",
        fontFamily: "inherit",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function badgeColors(variant: BadgeVariant) {
  switch (variant) {
    case "good":
      return {
        bg: "var(--green-subtle)",
        color: "var(--green)",
        border: "rgba(4, 120, 87, 0.22)",
      };
    case "warn":
      return {
        bg: "var(--red-subtle)",
        color: "var(--red)",
        border: "rgba(185, 28, 28, 0.2)",
      };
    default:
      return {
        bg: "var(--surface-muted)",
        color: "var(--text-2)",
        border: "var(--border)",
      };
  }
}

export function ModelResponseCard({
  r,
  badge,
  latencyTone,
  rating,
  onRate,
}: {
  r: WebProviderResult;
  badge: { label: string; variant: BadgeVariant } | null;
  latencyTone: "fast" | "slow" | "neutral";
  rating: number;
  onRate: (stars: number) => void;
}) {
  const color = providerUi(r.provider).color;
  const hasError = Boolean(r.error);
  const [copied, setCopied] = useState(false);
  const providerUpper = formatProviderDisplayName(r.provider);

  const latencyColor =
    hasError || latencyTone === "neutral"
      ? "var(--text-1)"
      : latencyTone === "fast"
        ? "var(--green)"
        : "var(--red)";

  const costColor =
    hasError ? "var(--text-1)" : r.costUsd === 0 ? "var(--green)" : "var(--amber)";

  const copyOutput = async () => {
    if (hasError || !r.output) return;
    try {
      await navigator.clipboard.writeText(r.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const badgeStyle = badge && !hasError ? badgeColors(badge.variant) : null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "0.85rem 1.05rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.65rem",
          borderLeft: `3px solid ${hasError ? "var(--red)" : color}`,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: hasError ? "var(--red)" : color,
            flexShrink: 0,
            marginTop: "0.35rem",
            opacity: hasError ? 1 : 0.9,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "var(--text-3)",
              letterSpacing: "0.06em",
            }}
          >
            {providerUpper}
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              color: "var(--text-1)",
              fontWeight: 700,
              marginTop: 3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-mono)",
            }}
          >
            {r.model}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem", flexShrink: 0 }}>
          {badgeStyle && badge && (
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "0.22rem 0.5rem",
                  borderRadius: 999,
                  background: badgeStyle.bg,
                  color: badgeStyle.color,
                  border: `1px solid ${badgeStyle.border}`,
                  whiteSpace: "nowrap",
                }}
              >
                {badge.label}
              </span>
          )}
          {hasError && (
            <span
              style={{
                fontSize: "0.62rem",
                color: "var(--red)",
                background: "var(--red-subtle)",
                border: "1px solid rgba(185, 28, 28, 0.2)",
                borderRadius: 999,
                padding: "0.22rem 0.5rem",
                fontWeight: 700,
              }}
            >
              Failed
            </span>
          )}
        </div>
      </div>

      {!hasError && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 0,
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-subtle)",
          }}
        >
          <div style={{ padding: "0.55rem 0.65rem", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Latency
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: latencyColor, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
              {r.latencyMs.toLocaleString()}ms
            </div>
          </div>
          <div style={{ padding: "0.55rem 0.65rem", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Tokens in → out
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)", marginTop: 2, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
              {r.inputTokens} → {r.outputTokens}
            </div>
          </div>
          <div style={{ padding: "0.55rem 0.65rem" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Cost
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: costColor, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
              {r.costUsd === 0 ? "$0.00" : formatCost(r.costUsd)}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          padding: "1rem 1.1rem",
          overflowY: "auto",
          maxHeight: 480,
          flex: 1,
          background: "var(--surface)",
        }}
      >
        {hasError ? (
          <div
            style={{
              color: "var(--red)",
              background: "var(--red-subtle)",
              border: "1px solid rgba(185, 28, 28, 0.18)",
              borderRadius: "var(--r-md)",
              padding: "0.85rem 1rem",
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

      {!hasError && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "0.55rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            background: "var(--surface-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.05rem" }} role="group" aria-label="Rate this response">
            {[1, 2, 3, 4, 5].map((n) => (
              <StarButton key={n} n={n} active={n <= rating} onClick={() => onRate(n === rating ? 0 : n)} />
            ))}
          </div>
          <button
            type="button"
            onClick={copyOutput}
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              borderRadius: "var(--r-md)",
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "var(--text-2)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
