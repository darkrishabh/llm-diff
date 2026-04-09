import React from "react";
import { Box, Text } from "ink";
import type { SuiteResult, ProviderSummary, TestCaseResult } from "@llm-diff/core";
import { formatCost } from "@llm-diff/core";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function bar(score: number, width = 12): string {
  const filled = Math.round(score * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function scoreColor(score: number): string {
  if (score >= 0.8) return "green";
  if (score >= 0.5) return "yellow";
  return "red";
}

// ─── Summary table ────────────────────────────────────────────────────────────

function SummaryTable({ summary }: { summary: ProviderSummary[] }) {
  const colW = { provider: 20, model: 24, score: 18, pass: 10, latency: 12, cost: 10 };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan"> Summary</Text>
      <Box>
        <Text bold dimColor>{"Provider".padEnd(colW.provider)}</Text>
        <Text bold dimColor>{"Model".padEnd(colW.model)}</Text>
        <Text bold dimColor>{"Score".padEnd(colW.score)}</Text>
        <Text bold dimColor>{"Pass/Total".padEnd(colW.pass)}</Text>
        <Text bold dimColor>{"Avg Latency".padEnd(colW.latency)}</Text>
        <Text bold dimColor>{"Total Cost"}</Text>
      </Box>
      <Text dimColor>{"─".repeat(colW.provider + colW.model + colW.score + colW.pass + colW.latency + colW.cost)}</Text>
      {summary.map((s) => (
        <Box key={`${s.provider}/${s.model}`}>
          <Text>{s.provider.padEnd(colW.provider)}</Text>
          <Text dimColor>{s.model.slice(0, colW.model - 2).padEnd(colW.model)}</Text>
          <Text color={scoreColor(s.score)}>
            {`${bar(s.score)} ${pct(s.score)}`.padEnd(colW.score)}
          </Text>
          <Text>{`${s.passed}/${s.total}`.padEnd(colW.pass)}</Text>
          <Text dimColor>{`${s.avgLatencyMs}ms`.padEnd(colW.latency)}</Text>
          <Text dimColor>{s.totalCostUsd === 0 ? "$0.00" : formatCost(s.totalCostUsd)}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ─── Per-case rows ────────────────────────────────────────────────────────────

function CaseRow({ c, idx, providerOrder }: { c: TestCaseResult; idx: number; providerOrder: string[] }) {
  const prompt = c.prompt.length > 60 ? c.prompt.slice(0, 57) + "…" : c.prompt;
  const varStr = Object.entries(c.vars).map(([k, v]) => `${k}=${v}`).join(", ");

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">#{idx + 1} </Text>
        <Text wrap="truncate-end">{prompt}</Text>
        {varStr && <Text dimColor> ({varStr})</Text>}
      </Box>
      {providerOrder.map((key) => {
        const pr = c.providerResults.find((r) => `${r.provider}/${r.model}` === key);
        if (!pr) return null;
        const icon = pr.error ? "✗" : pr.pass ? "✓" : "✗";
        const color = pr.error ? "red" : pr.pass ? "green" : "red";
        const label = `${pr.provider}/${pr.model}`;

        return (
          <Box key={key} marginLeft={2} flexDirection="column">
            <Box gap={1}>
              <Text color={color}>{icon}</Text>
              <Text dimColor>{label.slice(0, 36).padEnd(36)}</Text>
              {!pr.error && (
                <Text dimColor>{pr.latencyMs}ms</Text>
              )}
            </Box>
            {pr.assertions.map((a, i) => (
              <Box key={i} marginLeft={4}>
                <Text color={a.pass ? "green" : "red"}>{a.pass ? "✓" : "✗"} </Text>
                <Text dimColor>[{a.type}]</Text>
                {a.reason && <Text dimColor> — {a.reason}</Text>}
              </Box>
            ))}
            {pr.error && (
              <Box marginLeft={4}>
                <Text color="red">Error: {pr.error}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EvalView({ result, verbose = false }: { result: SuiteResult; verbose?: boolean }) {
  const providerOrder = result.summary.map((s) => `${s.provider}/${s.model}`);
  const totalPassed = result.summary.reduce((sum, s) => sum + s.passed, 0);
  const totalTests = result.summary.reduce((sum, s) => sum + s.total, 0);
  const allPassed = result.summary.every((s) => s.failed === 0);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color={allPassed ? "green" : "red"}>
          {allPassed ? "✓ All assertions passed" : `✗ ${totalTests - totalPassed} assertion(s) failed`}
        </Text>
        <Text dimColor>  ({result.cases.length} test case{result.cases.length !== 1 ? "s" : ""}, {result.summary.length} provider{result.summary.length !== 1 ? "s" : ""})</Text>
      </Box>

      <SummaryTable summary={result.summary} />

      {verbose && (
        <Box flexDirection="column">
          <Text bold color="cyan"> Details</Text>
          <Text dimColor>{"─".repeat(80)}</Text>
          {result.cases.map((c, i) => (
            <CaseRow key={i} c={c} idx={i} providerOrder={providerOrder} />
          ))}
        </Box>
      )}
    </Box>
  );
}
