"use client";

import { useMemo } from "react";
import type { WebProviderResult } from "../types";
import { diffLines } from "../lib/simple-line-diff";
import { providerUi } from "../lib/provider-ui";

export function ResponsesLineDiff({
  results,
  leftId,
  rightId,
  onLeftId,
  onRightId,
}: {
  results: WebProviderResult[];
  leftId: string;
  rightId: string;
  onLeftId: (id: string) => void;
  onRightId: (id: string) => void;
}) {
  const ok = results.filter((r) => !r.error && r.output.trim().length > 0);
  const left = results.find((r) => r.instanceId === leftId) ?? ok[0];
  const right = results.find((r) => r.instanceId === rightId) ?? ok[1] ?? ok[0];

  const lines = useMemo(() => {
    if (!left || !right || left.instanceId === right.instanceId) return [];
    return diffLines(left.output, right.output);
  }, [left, right]);

  const selectStyle = {
    flex: 1,
    minWidth: 0,
    padding: "0.45rem 0.6rem",
    borderRadius: "var(--r-md)",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-1)",
    fontSize: "0.8rem",
    fontFamily: "var(--font-mono)",
  } as const;

  if (ok.length < 2) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
        Need at least two successful responses to diff.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: "1 1 200px" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Baseline
          </span>
          <select value={left?.instanceId ?? ""} onChange={(e) => onLeftId(e.target.value)} style={selectStyle}>
            {results.map((r) => (
              <option
                key={r.instanceId}
                value={r.instanceId}
                disabled={Boolean(r.error) || !r.output.trim()}
              >
                {r.label}
                {r.error ? " (error)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: "1 1 200px" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Compare
          </span>
          <select value={right?.instanceId ?? ""} onChange={(e) => onRightId(e.target.value)} style={selectStyle}>
            {results.map((r) => (
              <option
                key={r.instanceId}
                value={r.instanceId}
                disabled={Boolean(r.error) || !r.output.trim()}
              >
                {r.label}
                {r.error ? " (error)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          fontSize: "0.72rem",
          color: "var(--text-3)",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <span>
          <span style={{ color: providerUi(left!.provider).color, fontWeight: 600 }}>{left!.label}</span>
          <span style={{ margin: "0 0.35rem" }}>vs</span>
          <span style={{ color: providerUi(right!.provider).color, fontWeight: 600 }}>{right!.label}</span>
        </span>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          background: "var(--surface-muted)",
          maxHeight: 560,
          overflow: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: "0.78rem",
          lineHeight: 1.55,
        }}
      >
        {lines.map((line, i) => {
          const bg =
            line.type === "add"
              ? "rgba(4, 120, 87, 0.12)"
              : line.type === "remove"
                ? "rgba(185, 28, 28, 0.1)"
                : "transparent";
          const prefix = line.type === "add" ? "+ " : line.type === "remove" ? "− " : "  ";
          const color =
            line.type === "add" ? "var(--green)" : line.type === "remove" ? "var(--red)" : "var(--text-2)";
          return (
            <div
              key={i}
              style={{
                padding: "0.08rem 0.65rem",
                background: bg,
                color,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {prefix}
              {line.text}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: "0.75rem", color: "var(--text-3)", margin: 0 }}>
        Line-level diff (LCS). Green lines appear only in the compare model; red only in the baseline.
      </p>
    </div>
  );
}
