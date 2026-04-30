import path from "node:path";
import { writeFileSync } from "node:fs";
import type { Provider } from "../engine/providers/base.js";
import {
  allocateHistoryIteration,
  buildBenchmark,
  ensureSkillWorkspaceDir,
  snapshotSkillToHistory,
} from "./artifacts.js";
import { consoleReporter } from "./console-reporter.js";
import { discoverSkills } from "./discover.js";
import { generateReport } from "./report.js";
import { runEval, type RunMode } from "./run-eval.js";
import { loadSkill } from "./skill.js";
import { slugify } from "./fs-utils.js";
import type { SkillsEvent } from "./types.js";

export interface EvaluateSkillsArgs {
  root: string;
  workspace: string;
  baseline?: boolean;
  target: { model: string; provider: Provider };
  judge: { model: string; provider: Provider };
  include?: string[];
  exclude?: string[];
  /**
   * Caller-level inference param defaults applied to every case's target
   * model. Lowest precedence — a skill's `defaults.target.params` and a
   * case's own `params` block both override this.
   */
  targetParams?: Record<string, unknown>;
  /** Same idea for the judge model. */
  judgeParams?: Record<string, unknown>;
  /**
   * Structured progress events. If neither `onEvent` nor `onLog` is provided,
   * the bundled rich `consoleReporter()` is used as a default so CLI users
   * see prompts, outputs, assertions, and timings out of the box.
   */
  onEvent?: (event: SkillsEvent) => void;
  /** Legacy flat-string log stream. Suppressed when `onEvent` is supplied. */
  onLog?: (line: string) => void;
  /**
   * Loop / EDD mode: in addition to the canonical flat layout, snapshot every
   * skill's freshly-written workspace directory into
   * `<workspace>/.history/iteration-N/<slug>/` so successive runs can be
   * compared. Off by default. Useful only for developers iterating on a skill.
   */
  loop?: boolean;
  /**
   * Render an NYC-style HTML report at `<workspace>/report/index.html` after
   * evaluation completes. Default true; pass `false` to skip.
   */
  report?: boolean;
}

export interface EvaluateSkillsResult {
  passed: number;
  failed: number;
  skills: {
    skill: string;
    slug: string;
    relPath: string;
    evals: number;
    passRate: number;
    benchmarkPath: string;
  }[];
  /** Set when `loop: true` — the freshly-allocated `.history/iteration-N` slot. */
  historyIteration?: number;
  /** Set when `report` is enabled (default true). */
  reportPath?: string;
}

export async function evaluateSkills(args: EvaluateSkillsArgs): Promise<EvaluateSkillsResult> {
  const refs = discoverSkills(args.root, { include: args.include, exclude: args.exclude }).filter((ref) => ref.hasEvals);
  const modes: RunMode[] = args.baseline ? ["with_skill", "without_skill"] : ["with_skill"];

  // Default to the bundled rich reporter when the caller didn't wire any
  // observability — keeps the out-of-the-box CLI experience informative.
  const emit: ((event: SkillsEvent) => void) | undefined = args.onEvent
    ? args.onEvent
    : args.onLog
      ? undefined
      : consoleReporter();

  let passed = 0;
  let failed = 0;
  const skills: EvaluateSkillsResult["skills"] = [];
  const writtenSkillDirs: { slug: string; dir: string }[] = [];

  for (const ref of refs) {
    args.onLog?.(`skill ${ref.name}: loading ${ref.relPath}`);
    const skill = loadSkill(ref.dir);
    const slug = slugify(skill.name);
    const skillDir = ensureSkillWorkspaceDir(args.workspace, slug);
    writeFileSync(
      path.join(skillDir, "meta.json"),
      `${JSON.stringify(
        {
          name: skill.name,
          slug,
          relPath: ref.relPath,
          target: args.target.model,
          judge: args.judge.model,
          modes,
          generated_at: new Date().toISOString(),
        },
        null,
        2
      )}\n`,
      "utf-8"
    );

    const aggregateRuns: { mode: RunMode; passRate: number; durationMs: number; tokens: number }[] = [];
    let skillPassed = 0;
    let skillFailed = 0;

    emit?.({
      type: "suite-start",
      skill: skill.name,
      relPath: ref.relPath,
      evalsCount: skill.evals.length,
      modes,
      target: args.target.model,
      judge: args.judge.model,
    });

    for (let index = 0; index < skill.evals.length; index++) {
      const evalCase = skill.evals[index];
      args.onLog?.(`skill ${skill.name}: eval ${evalCase.name ?? evalCase.id ?? index + 1}`);
      const result = await runEval({
        skill,
        eval: evalCase,
        index,
        modes,
        target: args.target,
        judge: args.judge,
        workspace: args.workspace,
        evalRootDir: skillDir,
        iteration: 0,
        targetParams: args.targetParams,
        judgeParams: args.judgeParams,
        onEvent: emit,
      });

      for (const mode of modes) {
        const modeResult = result.modes[mode];
        if (!modeResult) continue;
        aggregateRuns.push({
          mode,
          passRate: modeResult.grading.summary.pass_rate,
          durationMs: modeResult.timing.duration_ms,
          tokens: modeResult.timing.total_tokens,
        });
      }

      const withSkill = result.modes.with_skill;
      if (withSkill) {
        skillPassed += withSkill.grading.summary.passed;
        skillFailed += withSkill.grading.summary.failed;
      }
    }

    const benchmark = buildBenchmark(aggregateRuns);
    const benchmarkPath = path.join(skillDir, "benchmark.json");
    writeFileSync(benchmarkPath, `${JSON.stringify(benchmark, null, 2)}\n`, "utf-8");

    emit?.({
      type: "suite-end",
      skill: skill.name,
      benchmarkPath,
      benchmark,
    });

    writtenSkillDirs.push({ slug, dir: skillDir });
    passed += skillPassed;
    failed += skillFailed;
    const total = skillPassed + skillFailed;
    skills.push({
      skill: skill.name,
      slug,
      relPath: ref.relPath,
      evals: skill.evals.length,
      passRate: total === 0 ? 1 : skillPassed / total,
      benchmarkPath,
    });
  }

  // Loop mode: snapshot the freshly-written workspace into a history slot so
  // the developer can compare this run against earlier iterations.
  let historyIteration: number | undefined;
  if (args.loop && writtenSkillDirs.length > 0) {
    const history = allocateHistoryIteration(args.workspace);
    for (const { slug, dir } of writtenSkillDirs) {
      snapshotSkillToHistory(dir, history.dir, slug);
    }
    historyIteration = history.iteration;
  }

  // Render the static HTML report unless explicitly disabled. `report.ts`
  // reads everything from disk, so it works equally well against a freshly
  // finished run or against a `.history/iteration-N/` snapshot later.
  let reportPath: string | undefined;
  if (args.report !== false) {
    const result = generateReport({
      workspace: args.workspace,
      target: args.target.model,
      judge: args.judge.model,
    });
    reportPath = result.reportPath;
  }

  return { passed, failed, skills, historyIteration, reportPath };
}
