import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { runDiff, runDiffMany } from "@llm-diff/core";
import type { DiffResult, ProviderName, ProviderConfig } from "@llm-diff/core";
import { DiffView } from "./components/DiffView.js";
import { Spinner } from "./components/Spinner.js";

interface AppProps {
  prompt: string;
  providers: ProviderName[];
  config: ProviderConfig;
  runs: number;
  outputFormat: "pretty" | "json";
}

export function App({ prompt, providers, config, runs, outputFormat }: AppProps) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [diffs, setDiffs] = useState<DiffResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        if (runs > 1) {
          const results = await runDiffMany({ prompt, providers, config, runs });
          setDiffs(results);
        } else {
          const result = await runDiff({ prompt, providers, config });
          setDiffs([result]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setTimeout(() => exit(), 50);
      }
    };
    run();
  }, []);

  if (outputFormat === "json") {
    if (!loading) {
      process.stdout.write(JSON.stringify(diffs, null, 2) + "\n");
    }
    return null;
  }

  if (loading) {
    return (
      <Box>
        <Spinner label={`Querying ${providers.join(", ")}...`} />
      </Box>
    );
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  return (
    <Box flexDirection="column">
      {diffs.map((diff, i) => (
        <Box key={i} flexDirection="column">
          {diffs.length > 1 && (
            <Text bold color="yellow">
              — Run {i + 1} of {diffs.length} —
            </Text>
          )}
          <DiffView diff={diff} />
        </Box>
      ))}
    </Box>
  );
}
