import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { readFileSync } from "fs";
import {
  parseSuiteConfig,
  runSuite,
  ClaudeProvider,
  OllamaProvider,
  MinimaxProvider,
} from "@llm-diff/core";
import type { SuiteResult, TestCaseResult, Provider } from "@llm-diff/core";
import { EvalView } from "./components/EvalView.js";
import { Spinner } from "./components/Spinner.js";

export type JudgeChoice = "auto" | "claude" | "ollama" | "none";

export interface RunCommandProps {
  configPath: string;
  models: string;
  output: "pretty" | "json";
  verbose: boolean;
  failOnError: boolean;
  judge: JudgeChoice;
}

function buildJudgeProvider(judge: JudgeChoice): Provider | undefined {
  switch (judge) {
    case "none":
      return undefined;
    case "claude": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) {
        process.stderr.write("warn: --judge claude requires ANTHROPIC_API_KEY\n");
        return undefined;
      }
      return new ClaudeProvider(key);
    }
    case "ollama":
      return new OllamaProvider(process.env.OLLAMA_BASE_URL ?? "http://localhost:11434");
    case "auto":
      return process.env.ANTHROPIC_API_KEY
        ? new ClaudeProvider(process.env.ANTHROPIC_API_KEY)
        : undefined;
  }
}

export function RunCommand({
  configPath,
  models,
  output,
  verbose,
  failOnError,
  judge,
}: RunCommandProps) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [result, setResult] = useState<SuiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        // Load config
        const yaml = readFileSync(configPath, "utf-8");
        const config = parseSuiteConfig(yaml);

        // Build providers from --models flag using env vars
        const providerNames = models.split(",").map((m) => m.trim());
        const providers: Provider[] = providerNames.flatMap((name): Provider[] => {
          switch (name) {
            case "claude": {
              const key = process.env.ANTHROPIC_API_KEY;
              if (!key) { process.stderr.write(`warn: ANTHROPIC_API_KEY not set, skipping claude\n`); return []; }
              return [new ClaudeProvider(key)];
            }
            case "ollama":
              return [new OllamaProvider(process.env.OLLAMA_BASE_URL ?? "http://localhost:11434")];
            case "minimax": {
              const apiKey = process.env.MINIMAX_API_KEY;
              const groupId = process.env.MINIMAX_GROUP_ID;
              if (!apiKey || !groupId) {
                process.stderr.write(
                  "warn: MINIMAX_API_KEY and MINIMAX_GROUP_ID required for minimax — skipping\n"
                );
                return [];
              }
              return [new MinimaxProvider(apiKey, groupId)];
            }
            default:
              process.stderr.write(`warn: unknown provider "${name}" — skipping\n`);
              return [];
          }
        });

        if (providers.length === 0) {
          throw new Error("No providers available. Check your --models flag and env vars.");
        }

        const judgeProvider = buildJudgeProvider(judge);

        const totalCases = config.prompts.length * config.tests.length;
        setProgress({ done: 0, total: totalCases });

        const suiteResult = await runSuite({
          config,
          providers,
          judgeProvider,
          onCaseComplete: (_: TestCaseResult, index: number, total: number) => {
            setProgress({ done: index + 1, total });
          },
        });

        setResult(suiteResult);

        if (output === "json") {
          process.stdout.write(JSON.stringify(suiteResult, null, 2) + "\n");
        }

        if (failOnError) {
          const anyFailed = suiteResult.summary.some((s) => s.failed > 0);
          if (anyFailed) process.exitCode = 1;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        if (failOnError) process.exitCode = 1;
      } finally {
        setLoading(false);
        setTimeout(() => exit(), 50);
      }
    };
    run();
  }, [configPath, models, output, failOnError, judge]);

  if (output === "json") return null;

  if (loading) {
    const label = progress.total > 0
      ? `Running test ${progress.done + 1}/${progress.total}…`
      : "Loading suite…";
    return <Box><Spinner label={label} /></Box>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (!result) return null;

  return <EvalView result={result} verbose={verbose} />;
}
