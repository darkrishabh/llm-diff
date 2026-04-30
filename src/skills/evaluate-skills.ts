import path from "node:path";
import { writeFileSync } from "node:fs";
import type { Provider } from "../engine/providers/base.js";
import { buildBenchmark, ensureIterationDir } from "./artifacts.js";
import { discoverSkills } from "./discover.js";
import { runEval, type RunMode } from "./run-eval.js";
import { loadSkill } from "./skill.js";
import { slugify } from "./fs-utils.js";

export interface EvaluateSkillsArgs {
  root: string;
  workspace: string;
  baseline?: boolean;
  target: { model: string; provider: Provider };
  judge: { model: string; provider: Provider };
  include?: string[];
  exclude?: string[];
  onLog?: (line: string) => void;
}

export interface EvaluateSkillsResult {
  iteration: number;
  passed: number;
  failed: number;
  skills: {
    skill: string;
    relPath: string;
    evals: number;
    passRate: number;
    benchmarkPath: string;
  }[];
}

export async function evaluateSkills(args: EvaluateSkillsArgs): Promise<EvaluateSkillsResult> {
  const refs = discoverSkills(args.root, { include: args.include, exclude: args.exclude }).filter((ref) => ref.hasEvals);
  const { iteration } = ensureIterationDir(args.workspace);
  const modes: RunMode[] = args.baseline ? ["with_skill", "without_skill"] : ["with_skill"];
  let passed = 0;
  let failed = 0;
  const skills: EvaluateSkillsResult["skills"] = [];

  for (const ref of refs) {
    args.onLog?.(`skill ${ref.name}: loading ${ref.relPath}`);
    const skill = loadSkill(ref.dir);
    const aggregateRuns: { mode: RunMode; passRate: number; durationMs: number; tokens: number }[] = [];
    let skillPassed = 0;
    let skillFailed = 0;

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
        evalRootDir: path.join(args.workspace, `iteration-${iteration}`, slugify(skill.name)),
        iteration,
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
    const skillDir = path.join(args.workspace, `iteration-${iteration}`, slugify(skill.name));
    const benchmarkPath = path.join(skillDir, "benchmark.json");
    writeFileSync(benchmarkPath, `${JSON.stringify(benchmark, null, 2)}\n`, "utf-8");

    passed += skillPassed;
    failed += skillFailed;
    const total = skillPassed + skillFailed;
    skills.push({
      skill: skill.name,
      relPath: ref.relPath,
      evals: skill.evals.length,
      passRate: total === 0 ? 1 : skillPassed / total,
      benchmarkPath,
    });
  }

  return { iteration, passed, failed, skills };
}
