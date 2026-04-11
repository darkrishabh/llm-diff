import type { ProviderResult } from "../types.js";
import type { Provider } from "./base.js";

export interface SubprocessOptions {
  /**
   * Timeout in milliseconds. Defaults to 120_000 (2 min).
   * Set higher for slow local models.
   */
  timeoutMs?: number;
  /**
   * Extra CLI flags to append before the prompt.
   */
  extraArgs?: string[];
  /**
   * Max characters of output to capture. Defaults to 100_000.
   */
  maxOutputChars?: number;
  /**
   * If set, `[modelFlag, model]` is injected into the command before the prompt.
   * e.g. "--model" → `claude -p --model claude-opus-4-6 "<prompt>"`
   */
  modelFlag?: string;
}

/**
 * SubprocessProvider — wraps any local CLI tool that accepts a prompt as a
 * positional argument and writes its response to stdout.
 *
 * Works out of the box with:
 *   - Claude Code CLI:  binary="claude"  args=["-p"]
 *   - OpenAI Codex CLI: binary="codex"   args=[]
 *
 * Token counts are unavailable from subprocess CLIs, so they are reported
 * as 0 and cost is reported as $0.00.
 */
export class SubprocessProvider implements Provider {
  readonly name: string;
  readonly model: string;

  private binary: string;
  /** Args that precede the prompt string, e.g. ["-p"] for `claude -p "..."` */
  private prefixArgs: string[];
  private options: SubprocessOptions;

  constructor(
    name: string,
    binary: string,
    prefixArgs: string[],
    model: string,
    options: SubprocessOptions = {}
  ) {
    this.name = name;
    this.binary = binary;
    this.prefixArgs = prefixArgs;
    this.model = model;
    this.options = options;
  }

  async complete(prompt: string): Promise<ProviderResult> {
    const start = Date.now();
    const timeoutMs = this.options.timeoutMs ?? 120_000;
    const maxChars = this.options.maxOutputChars ?? 100_000;
    const extraArgs = this.options.extraArgs ?? [];

    try {
      const { spawn } = await import("child_process");

      // Only pass --model if we have a real model name (not empty / not equal to the provider name)
      const isValidModel = this.model && this.model !== this.name;
      const modelArgs =
        this.options.modelFlag && isValidModel
          ? [this.options.modelFlag, this.model]
          : [];

      const args = [...this.prefixArgs, ...modelArgs, ...extraArgs, prompt];

      const output = await new Promise<string>((resolve, reject) => {
        // stdio: ['ignore', …] ensures stdin is /dev/null so the CLI doesn't
        // wait for terminal input or error with "stdin is not a terminal"
        const child = spawn(this.binary, args, {
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
        child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

        const timer = setTimeout(() => {
          child.kill();
          reject(new Error(`Timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        child.on("close", (code) => {
          clearTimeout(timer);
          if (code !== 0) {
            const msg = `Command failed: ${this.binary} ${args.join(" ")}`;
            reject(new Error(stderr.trim() ? `${msg}\n${stderr.trim()}` : msg));
          } else {
            resolve(stdout);
          }
        });

        child.on("error", (err) => { clearTimeout(timer); reject(err); });
      });

      return {
        provider: this.name,
        model: this.model,
        output: output.slice(0, maxChars),
        latencyMs: Date.now() - start,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      };
    } catch (err: unknown) {
      return {
        provider: this.name,
        model: this.model,
        output: "",
        latencyMs: Date.now() - start,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ─── Ready-made factory helpers ───────────────────────────────────────────────

/**
 * Claude Code CLI (`claude -p --model <model> "<prompt>"`).
 * Install: npm i -g @anthropic-ai/claude-code
 */
export function createClaudeCLIProvider(model: string, options?: SubprocessOptions): SubprocessProvider {
  return new SubprocessProvider("claude-cli", "claude", ["-p"], model, {
    modelFlag: "--model",
    ...options,
  });
}

/**
 * OpenAI Codex CLI (`codex exec -m <model> "<prompt>"`).
 * Install: npm i -g @openai/codex
 * Uses the `exec` subcommand for non-interactive execution.
 */
export function createCodexProvider(model: string, options?: SubprocessOptions): SubprocessProvider {
  return new SubprocessProvider("codex", "codex", ["exec"], model, {
    modelFlag: "-m",
    ...options,
  });
}
