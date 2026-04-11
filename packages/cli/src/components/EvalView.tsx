import React from "react";
import { Box, Text } from "ink";
import type { SuiteResult, ProviderSummary, TestCaseResult, ProviderTestResult } from "@prompt-diff/core";
import { formatCost } from "@prompt-diff/core";

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

// ─── Case × provider matrix (default view) ────────────────────────────────────

const COL_CASE = 42;
const COL_CELL = 11;

function userAssertions(pr: ProviderTestResult) {
  return pr.assertions.filter((a) => a.type !== "provider-error");
}

function MatrixCell({ pr }: { pr: ProviderTestResult | undefined }) {
  const w = COL_CELL;
  if (!pr) {
    return (
      <Box width={w} flexShrink={0}>
        <Text dimColor>{"—".padStart(w - 1)}</Text>
      </Box>
    );
  }
  if (pr.error) {
    return (
      <Box width={w} flexShrink={0}>
        <Text color="red" bold>
          {"ERR".padEnd(w - 1)}
        </Text>
      </Box>
    );
  }
  const ua = userAssertions(pr);
  const suffix =
    ua.length > 0 ? ` ${ua.filter((a) => a.pass).length}/${ua.length}` : "";
  const label = `${pr.pass ? "✓" : "✗"}${suffix}`.slice(0, w - 1).padEnd(w - 1);
  return (
    <Box width={w} flexShrink={0}>
      <Text color={pr.pass ? "green" : "red"}>{label}</Text>
    </Box>
  );
}

function CaseMatrix({
  cases,
  providerOrder,
}: {
  cases: TestCaseResult[];
  providerOrder: string[];
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan"> Test matrix</Text>
      <Text dimColor> Rows = test cases · Columns = providers (✓/✗, assertion pass/total)</Text>
      <Box marginTop={1}>
        <Box width={4} flexShrink={0}>
          <Text bold dimColor>
            {"#".padEnd(3)}
          </Text>
        </Box>
        <Box width={COL_CASE} flexShrink={0}>
          <Text bold dimColor>
            {"Case".padEnd(COL_CASE - 1)}
          </Text>
        </Box>
        {providerOrder.map((key) => {
          const short = key.includes("/") ? key.split("/")[0]! : key;
          const head = short.slice(0, COL_CELL - 2).padEnd(COL_CELL - 1);
          return (
            <Box key={key} width={COL_CELL} flexShrink={0}>
              <Text bold dimColor>
                {head}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Text dimColor>
        {"─".repeat(4 + COL_CASE + providerOrder.length * COL_CELL)}
      </Text>
      {cases.map((c, i) => {
        const prompt =
          c.prompt.length > COL_CASE - 2
            ? c.prompt.slice(0, COL_CASE - 4) + "… "
            : c.prompt.padEnd(COL_CASE - 1);
        return (
          <Box key={i}>
            <Box width={4} flexShrink={0}>
              <Text dimColor>{`${i + 1}`.padEnd(3)}</Text>
            </Box>
            <Box width={COL_CASE} flexShrink={0}>
              <Text>{prompt}</Text>
            </Box>
            {providerOrder.map((key) => {
              const pr = c.providerResults.find((r) => `${r.provider}/${r.model}` === key);
              return <MatrixCell key={key} pr={pr} />;
            })}
          </Box>
        );
      })}
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
            {pr.assertions
              .filter((a) => !(pr.error && a.type === "provider-error"))
              .map((a, i) =>
                a.type === "llm-rubric" ? (
                  <Box key={i} marginLeft={4} flexDirection="column" marginBottom={1}>
                    <Box flexDirection="row" gap={1}>
                      <Text bold color="magenta">
                        [{a.type}]
                      </Text>
                      <Text bold color={a.pass ? "green" : "red"}>
                        {a.pass ? "Pass" : "Fail"}
                      </Text>
                    </Box>
                    {a.rubricCriterion ? (
                      <Box marginLeft={2} flexDirection="column">
                        <Text dimColor>Rubric:</Text>
                        <Text wrap="wrap">{a.rubricCriterion}</Text>
                      </Box>
                    ) : null}
                    <Box marginLeft={2} flexDirection="column">
                      <Text dimColor>{a.pass ? "Why it passed" : "Why it failed"}:</Text>
                      <Text wrap="wrap">{a.reason ?? "—"}</Text>
                    </Box>
                  </Box>
                ) : (
                  <Box key={i} marginLeft={4}>
                    <Text color={a.pass ? "green" : "red"}>{a.pass ? "✓" : "✗"} </Text>
                    <Text dimColor>[{a.type}]</Text>
                    {a.reason && <Text dimColor> — {a.reason}</Text>}
                  </Box>
                )
            )}
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
  const allPassed = result.summary.every((s) => s.failed === 0);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color={allPassed ? "green" : "red"}>
          {allPassed
            ? "✓ All test results passed"
            : `✗ ${result.summary.reduce((acc, s) => acc + s.failed, 0)} failed (provider × case)`}
        </Text>
        <Text dimColor>  ({result.cases.length} test case{result.cases.length !== 1 ? "s" : ""}, {result.summary.length} provider{result.summary.length !== 1 ? "s" : ""})</Text>
      </Box>

      <SummaryTable summary={result.summary} />

      <CaseMatrix cases={result.cases} providerOrder={providerOrder} />

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
