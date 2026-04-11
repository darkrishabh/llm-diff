import React from "react";
import { Box, Text } from "ink";
import type { DiffResult, ProviderResult } from "@prompt-diff/core";
import { formatCost } from "@prompt-diff/core";

function ProviderCard({ result }: { result: ProviderResult }) {
  const color = result.error ? "red" : "green";
  const latency = `${result.latencyMs}ms`;
  const tokens = `${result.inputTokens}→${result.outputTokens} tok`;
  const cost = formatCost(result.costUsd);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text bold color={color}>
          {result.provider.toUpperCase()} ({result.model})
        </Text>
        <Text dimColor>
          {latency}  {tokens}  {cost}
        </Text>
      </Box>
      <Box marginTop={1}>
        {result.error ? (
          <Text color="red">Error: {result.error}</Text>
        ) : (
          <Text wrap="wrap">{result.output}</Text>
        )}
      </Box>
    </Box>
  );
}

export function DiffView({ diff }: { diff: DiffResult }) {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Prompt: </Text>
        <Text color="cyan" wrap="wrap">
          {diff.prompt}
        </Text>
      </Box>
      {diff.results.map((r) => (
        <ProviderCard key={r.provider} result={r} />
      ))}
      <Text dimColor>Ran at {diff.ranAt}</Text>
    </Box>
  );
}
