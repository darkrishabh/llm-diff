#!/usr/bin/env node
import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { readFileSync } from "fs";
import { App } from "./app.js";
import { RunCommand, type JudgeChoice } from "./run-command.js";
import type { ProviderName, ProviderConfig } from "@prompt-diff/core";

const program = new Command();

program
  .name("prompt-diff")
  .description("Prompt-Diff — compare and evaluate LLM outputs across providers")
  .version("0.1.0");

// ── diff (default) ────────────────────────────────────────────────────────────

program
  .command("diff [prompt]", { isDefault: true })
  .description("Run a single prompt across providers and diff outputs")
  .argument("[prompt]", "Prompt to send to all providers")
  .option("--file <path>", "Append file contents to the prompt")
  .option(
    "--models <list>",
    "Comma-separated providers (claude,ollama,minimax)",
    "claude,ollama"
  )
  .option("--runs <n>", "Number of runs for averaging", "1")
  .option("--output <format>", "Output format: pretty or json", "pretty")
  .action(
    (
      promptArg: string | undefined,
      opts: { file?: string; models: string; runs: string; output: string }
    ) => {
      if (!promptArg && !opts.file) {
        process.stderr.write("error: provide a prompt argument or --file\n");
        process.exit(1);
      }

      let prompt = promptArg ?? "";
      if (opts.file) {
        const fileContent = readFileSync(opts.file, "utf-8");
        prompt = prompt
          ? `${prompt}\n\n\`\`\`\n${fileContent}\n\`\`\``
          : fileContent;
      }

      const providers = opts.models.split(",").map((m) => m.trim()) as ProviderName[];
      const config: ProviderConfig = {
        claude: process.env.ANTHROPIC_API_KEY
          ? { apiKey: process.env.ANTHROPIC_API_KEY }
          : undefined,
        ollama: { baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434" },
        minimax:
          process.env.MINIMAX_API_KEY && process.env.MINIMAX_GROUP_ID
            ? { apiKey: process.env.MINIMAX_API_KEY, groupId: process.env.MINIMAX_GROUP_ID }
            : undefined,
      };

      render(
        React.createElement(App, {
          prompt,
          providers,
          config,
          runs: Math.max(1, parseInt(opts.runs, 10)),
          outputFormat: opts.output === "json" ? "json" : "pretty",
        })
      );
    }
  );

// ── run (test suite) ──────────────────────────────────────────────────────────

program
  .command("run")
  .description(
    "Run a YAML test suite and evaluate outputs with assertions (see examples/*.yaml)"
  )
  .requiredOption("--config <path>", "Path to suite YAML file (e.g. examples/prompt-diff.yaml)")
  .option(
    "--models <list>",
    "Comma-separated providers (claude, ollama, minimax — env vars as for diff)",
    "claude,ollama"
  )
  .option("--output <format>", "Output format: pretty or json", "pretty")
  .option("--verbose", "Show per-case assertion details and full prompts", false)
  .option("--fail-on-error", "Exit with code 1 if any provider result fails", false)
  .option(
    "--judge <name>",
    "Provider for llm-rubric: auto (Claude if ANTHROPIC_API_KEY), claude, ollama, none",
    "auto"
  )
  .action(
    (opts: {
      config: string;
      models: string;
      output: string;
      verbose: boolean;
      failOnError: boolean;
      judge: string;
    }) => {
      const j = opts.judge.toLowerCase();
      const allowed = new Set(["auto", "claude", "ollama", "none"]);
      if (!allowed.has(j)) {
        process.stderr.write("error: --judge must be one of: auto, claude, ollama, none\n");
        process.exit(1);
      }

      render(
        React.createElement(RunCommand, {
          configPath: opts.config,
          models: opts.models,
          output: opts.output === "json" ? "json" : "pretty",
          verbose: opts.verbose,
          failOnError: opts.failOnError,
          judge: j as JudgeChoice,
        })
      );
    }
  );

program.parse();
