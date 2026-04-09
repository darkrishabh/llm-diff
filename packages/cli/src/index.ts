#!/usr/bin/env node
import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { readFileSync } from "fs";
import { App } from "./app.js";
import type { ProviderName, ProviderConfig } from "@llm-diff/core";

const program = new Command();

program
  .name("llm-diff")
  .description("Diff LLM outputs across Claude, Ollama, and Minimax")
  .version("0.1.0")
  .argument("<prompt>", "Prompt to send to all providers")
  .option("--file <path>", "Append file contents to the prompt")
  .option(
    "--models <list>",
    "Comma-separated providers to use (claude,ollama,minimax)",
    "claude,ollama"
  )
  .option("--runs <n>", "Number of runs for averaging", "1")
  .option("--output <format>", "Output format: pretty or json", "pretty")
  .action(
    (
      promptArg: string,
      opts: {
        file?: string;
        models: string;
        runs: string;
        output: string;
      }
    ) => {
      let prompt = promptArg;

      if (opts.file) {
        const fileContent = readFileSync(opts.file, "utf-8");
        prompt = `${prompt}\n\n\`\`\`\n${fileContent}\n\`\`\``;
      }

      const providers = opts.models
        .split(",")
        .map((m) => m.trim()) as ProviderName[];

      const config: ProviderConfig = {
        claude: process.env.ANTHROPIC_API_KEY
          ? { apiKey: process.env.ANTHROPIC_API_KEY }
          : undefined,
        ollama: {
          baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        },
        minimax:
          process.env.MINIMAX_API_KEY && process.env.MINIMAX_GROUP_ID
            ? {
                apiKey: process.env.MINIMAX_API_KEY,
                groupId: process.env.MINIMAX_GROUP_ID,
              }
            : undefined,
      };

      const runs = Math.max(1, parseInt(opts.runs, 10));
      const outputFormat = opts.output === "json" ? "json" : "pretty";

      render(
        React.createElement(App, {
          prompt,
          providers,
          config,
          runs,
          outputFormat,
        })
      );
    }
  );

program.parse();
