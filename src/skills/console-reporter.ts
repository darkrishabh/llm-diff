/**
 * Default rich console reporter for the skills event stream.
 *
 * Consumes `SkillsEvent`s emitted by `evaluateSkills` / `runEval` and prints a
 * human-readable, optionally colored summary that includes:
 *   - per-suite header with skill name, relative path, target/judge models
 *   - per-eval prompt, system snippet, output snippet
 *   - per-assertion check or X marks with judge evidence on failures
 *   - timing/tokens line per run
 *   - delta (with_skill vs without_skill) at suite end when baseline mode is on
 *
 * Zero runtime dependencies — color detection honors NO_COLOR / FORCE_COLOR / TTY.
 */

import type {
  AssertionResult,
  EvalEndEvent,
  EvalStartEvent,
  RunMode,
  SkillsEvent,
  SuiteEndEvent,
  SuiteStartEvent,
  ToolCall,
} from "./types.js";

export interface ConsoleReporterOptions {
  /**
   * Whether to emit ANSI color codes.
   *   - "auto" (default): on when stdout is a TTY and NO_COLOR is unset
   *   - true: always on (also via FORCE_COLOR)
   *   - false: always off
   */
  color?: "auto" | boolean;
  /**
   * Verbose mode prints full prompts, full outputs, and the judge prompt.
   * Default: false (snippets only).
   */
  verbose?: boolean;
  /** Override the output sink. Defaults to writing to stdout with a newline. */
  out?: (line: string) => void;
  /** Maximum length of inline snippets in non-verbose mode. Default: 200. */
  snippetLength?: number;
}

const RESET = "\x1b[0m";
const codes = {
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

type ColorName = keyof typeof codes;

function detectColor(option: "auto" | boolean | undefined): boolean {
  if (option === true) return true;
  if (option === false) return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") return true;
  return Boolean(process.stdout.isTTY);
}

function makePainter(enabled: boolean): (name: ColorName, text: string) => string {
  if (!enabled) return (_name, text) => text;
  return (name, text) => `${codes[name]}${text}${RESET}`;
}

function clip(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function indent(text: string, prefix = "      "): string {
  return text.split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m${seconds}s`;
}

function modeBadge(mode: RunMode, paint: (n: ColorName, t: string) => string): string {
  return mode === "with_skill" ? paint("cyan", "[with_skill]") : paint("magenta", "[without_skill]");
}

function summarizeAssertions(results: AssertionResult[], paint: (n: ColorName, t: string) => string): string {
  if (results.length === 0) return paint("gray", "(no assertions)");
  return results
    .map((r, i) => (r.passed ? paint("green", `\u2713 ${i + 1}`) : paint("red", `\u2717 ${i + 1}`)))
    .join("  ");
}

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function consoleReporter(options: ConsoleReporterOptions = {}): (event: SkillsEvent) => void {
  const colorOn = detectColor(options.color);
  const paint = makePainter(colorOn);
  const out = options.out ?? ((line: string) => process.stdout.write(`${line}\n`));
  const verbose = options.verbose === true;
  const snippetLength = options.snippetLength ?? 200;

  // Track per-skill counter so the per-line numbering is stable when baseline
  // doubles the number of runs.
  const evalCounters = new Map<string, number>();

  function onSuiteStart(e: SuiteStartEvent): void {
    const head = paint("bold", `\u25b6 ${e.skill}`);
    const rel = paint("gray", e.relPath);
    out("");
    out(`${head}  ${rel}`);
    const meta = [
      `${pluralize(e.evalsCount, "eval")}`,
      `target=${e.target}`,
      `judge=${e.judge}`,
      `modes=${e.modes.join(",")}`,
    ].join("  ");
    out(`  ${paint("gray", meta)}`);
    evalCounters.set(e.skill, 0);
  }

  function onEvalStart(e: EvalStartEvent): void {
    const counter = (evalCounters.get(e.skill) ?? 0) + 1;
    evalCounters.set(e.skill, counter);

    const label = e.evalName ? e.evalName : e.evalId !== undefined ? `eval-${e.evalId}` : `eval-${e.evalIndex + 1}`;
    const id = e.evalId !== undefined ? `#${e.evalId}` : `#${e.evalIndex + 1}`;
    const fileTag = e.fileCount > 0 ? paint("gray", ` (+${e.fileCount} file${e.fileCount === 1 ? "" : "s"})`) : "";

    out("");
    out(
      `  ${paint("bold", `${id} ${label}`)}  ${modeBadge(e.mode, paint)}${fileTag}  ${paint("gray", `[${counter}]`)}`
    );

    if (verbose) {
      if (e.system) {
        out(`    ${paint("gray", "system:")}`);
        out(indent(e.system, "      "));
      }
      out(`    ${paint("gray", "user:")}`);
      out(indent(e.user, "      "));
    } else {
      if (e.system) {
        out(`    ${paint("gray", "system:")}  ${clip(e.system, snippetLength)}`);
      }
      out(`    ${paint("gray", "user:")}    ${clip(e.user, snippetLength)}`);
    }

    if (e.tools && e.tools.length > 0) {
      const names = e.tools.map((t) => t.function.name).join(", ");
      const choice = typeof e.toolChoice === "string"
        ? e.toolChoice
        : e.toolChoice
          ? `force=${e.toolChoice.function.name}`
          : "auto";
      out(`    ${paint("gray", "tools:")}   ${paint("yellow", names)} ${paint("gray", `(choice=${choice})`)}`);
    }
  }

  function summarizeToolCalls(calls: ToolCall[]): string {
    return calls
      .map((c) => {
        const args = c.parsedArguments !== undefined
          ? JSON.stringify(c.parsedArguments)
          : c.function.arguments || "";
        return `${c.function.name}(${clip(args, 120)})`;
      })
      .join(", ");
  }

  function onEvalEnd(e: EvalEndEvent): void {
    const summary = e.grading.summary;
    const passed = summary.failed === 0 && summary.total > 0;
    const verdict =
      summary.total === 0
        ? paint("gray", "NO ASSERTIONS")
        : passed
          ? paint("green", "PASS")
          : paint("red", "FAIL");

    if (verbose) {
      out(`    ${paint("gray", "output:")}`);
      out(indent(e.output || "(empty)", "      "));
    } else {
      out(`    ${paint("gray", "output:")}  ${clip(e.output || "(empty)", snippetLength)}`);
    }

    if (e.toolCalls && e.toolCalls.length > 0) {
      out(`    ${paint("gray", "calls:")}   ${paint("yellow", summarizeToolCalls(e.toolCalls))}`);
      if (verbose) {
        for (const [i, c] of e.toolCalls.entries()) {
          const args = c.parsedArguments !== undefined
            ? JSON.stringify(c.parsedArguments, null, 2)
            : c.function.arguments || "(empty)";
          out(`      ${paint("yellow", `[${i + 1}] ${c.function.name}`)}`);
          out(indent(args, "          "));
        }
      }
    }

    if (e.grading.assertion_results.length > 0) {
      out(`    ${paint("gray", "asserts:")} ${summarizeAssertions(e.grading.assertion_results, paint)}`);
      for (const [i, r] of e.grading.assertion_results.entries()) {
        if (r.passed && !verbose) continue;
        const num = paint(r.passed ? "green" : "red", `#${i + 1}`);
        const status = r.passed ? paint("green", "PASS") : paint("red", "FAIL");
        out(`      ${num} ${status} ${paint("gray", "\u2014")} ${clip(r.text, snippetLength)}`);
        if (r.evidence) out(`         ${paint("gray", "evidence:")} ${clip(r.evidence, snippetLength)}`);
      }
    }

    if (verbose && e.judgePrompt) {
      out(`    ${paint("gray", "judge prompt:")}`);
      out(indent(e.judgePrompt, "      "));
    }

    const stats = `${formatDuration(e.timing.duration_ms)} \u00b7 ${e.timing.total_tokens} tokens \u00b7 ${verdict}`;
    out(`    ${stats}`);
  }

  function onSuiteEnd(e: SuiteEndEvent): void {
    const rs = e.benchmark.run_summary;
    const withPct = (rs.with_skill.pass_rate.mean * 100).toFixed(1);
    const withTime = rs.with_skill.time_seconds.mean.toFixed(2);
    const withTokens = Math.round(rs.with_skill.tokens.mean);

    if (rs.without_skill && rs.delta) {
      const withoutPct = (rs.without_skill.pass_rate.mean * 100).toFixed(1);
      const withoutTime = rs.without_skill.time_seconds.mean.toFixed(2);
      const withoutTokens = Math.round(rs.without_skill.tokens.mean);
      const ppDelta = rs.delta.pass_rate * 100;
      const ppColor: ColorName = ppDelta > 0 ? "green" : ppDelta < 0 ? "red" : "gray";
      const sign = (n: number, suffix = "") => `${n >= 0 ? "+" : ""}${n.toFixed(1)}${suffix}`;
      out("");
      out(
        `  ${paint("bold", "summary")}  ${paint("cyan", `with_skill ${withPct}%`)}  vs  ${paint(
          "magenta",
          `without_skill ${withoutPct}%`
        )}`
      );
      out(
        `    ${paint("gray", "\u0394")} pass-rate ${paint(ppColor, sign(ppDelta, "pp"))}  ` +
          `time ${sign(rs.delta.time_seconds, "s")}  ` +
          `tokens ${sign(rs.delta.tokens)}`
      );
      out(`    ${paint("gray", "with_skill:")}    ${withTime}s avg \u00b7 ${withTokens} tok avg`);
      out(`    ${paint("gray", "without_skill:")} ${withoutTime}s avg \u00b7 ${withoutTokens} tok avg`);
    } else {
      out("");
      out(
        `  ${paint("bold", "summary")}  ${paint("cyan", `with_skill ${withPct}%`)}  ${paint(
          "gray",
          `\u00b7 ${withTime}s avg \u00b7 ${withTokens} tok avg`
        )}`
      );
    }
    out(`  ${paint("gray", `benchmark: ${e.benchmarkPath}`)}`);
  }

  return (event: SkillsEvent) => {
    switch (event.type) {
      case "suite-start":
        onSuiteStart(event);
        return;
      case "eval-start":
        onEvalStart(event);
        return;
      case "eval-end":
        onEvalEnd(event);
        return;
      case "suite-end":
        onSuiteEnd(event);
        return;
    }
  };
}
