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
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const execFileAsync = promisify(execFile);

      const modelArgs =
        this.options.modelFlag ? [this.options.modelFlag, this.model] : [];

      const { stdout } = await execFileAsync(
        this.binary,
        [...this.prefixArgs, ...modelArgs, ...extraArgs, prompt],
        { timeout: timeoutMs, maxBuffer: maxChars * 2 }
      );

      const output = stdout.slice(0, maxChars);

      return {
        provider: this.name,
        model: this.model,
        output,
        latencyMs: Date.now() - start,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : String(err);

      // execFile puts stderr in err.stderr when the process exits non-zero
      const stderr = (err as { stderr?: string }).stderr?.trim();
      const detail = stderr ? `${message}\n${stderr}` : message;

      return {
        provider: this.name,
        model: this.model,
        output: "",
        latencyMs: Date.now() - start,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        error: detail,
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
 * OpenAI Codex CLI (`codex --model <model> "<prompt>"`).
 * Install: npm i -g @openai/codex
 */
export function createCodexProvider(model: string, options?: SubprocessOptions): SubprocessProvider {
  return new SubprocessProvider("codex", "codex", [], model, {
    modelFlag: "--model",
    ...options,
  });
}
