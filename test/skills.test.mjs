import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildBenchmark,
  discoverSkills,
  ensureIterationDir,
  evaluateSkills,
  gradeOutputs,
  loadSkill,
  runEval,
} from "../dist/skills/index.js";

function tempRoot() {
  return mkdtempSync(path.join(tmpdir(), "bench-ai-skills-"));
}

function writeSkill(root, name = "csv-analyzer") {
  const dir = path.join(root, name);
  mkdirSync(path.join(dir, "references"), { recursive: true });
  mkdirSync(path.join(dir, "scripts"), { recursive: true });
  mkdirSync(path.join(dir, "evals", "files"), { recursive: true });
  writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: Analyze CSV files.\n---\n\nUse CSV-specific checks.\n`);
  writeFileSync(path.join(dir, "references", "REFERENCE.md"), "Reference details");
  writeFileSync(path.join(dir, "scripts", "helper.sh"), "#!/usr/bin/env bash\necho helper\n");
  writeFileSync(path.join(dir, "evals", "files", "data.csv"), "month,revenue\nJan,10\n");
  writeFileSync(path.join(dir, "evals", "evals.json"), JSON.stringify({
    skill_name: name,
    evals: [{
      id: 1,
      name: "top-months",
      prompt: "Find top revenue months.",
      expected_output: "A summary of the top months.",
      files: ["evals/files/data.csv", "evals/files/missing.csv"],
      assertions: ["The output mentions top revenue months."]
    }]
  }));
  return dir;
}

function provider(output, extra = {}) {
  return {
    name: "mock",
    model: "mock-model",
    prompts: [],
    async complete(prompt) {
      this.prompts.push(prompt);
      return { provider: "mock", model: "mock-model", output, latencyMs: 25, inputTokens: 3, outputTokens: 4, costUsd: 0 };
    },
    ...extra,
  };
}

function judgeProvider(passed = true) {
  return provider(JSON.stringify({
    assertion_results: [{ text: "placeholder", passed, evidence: passed ? "Output contains the required phrase." : "Missing required phrase." }],
    summary: { passed: passed ? 1 : 0, failed: passed ? 0 : 1, total: 1, pass_rate: passed ? 1 : 0 }
  }));
}

test("loadSkill reads spec files and safe attachment states", () => {
  const root = tempRoot();
  const dir = writeSkill(root);
  const skill = loadSkill(dir);
  assert.equal(skill.name, "csv-analyzer");
  assert.equal(skill.references[0].kind, "text");
  assert.equal(skill.scripts[0].content, "#!/usr/bin/env bash");
  assert.equal(skill.evals.length, 1);
});

test("discoverSkills finds nested skills and plugin names", () => {
  const root = tempRoot();
  const plugin = path.join(root, "domain", "plugin");
  mkdirSync(path.join(plugin, ".claude-plugin"), { recursive: true });
  writeFileSync(path.join(plugin, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "demo-plugin" }));
  writeSkill(path.join(plugin, "skills"), "csv-analyzer");
  const refs = discoverSkills(root);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].pluginName, "demo-plugin");
  assert.equal(refs[0].hasEvals, true);
});

test("gradeOutputs returns spec grading JSON and fails closed", async () => {
  const good = await gradeOutputs({
    modelOutput: "Top revenue months: Jan",
    assertions: ["The output mentions top revenue months."],
    judge: { model: "judge", provider: judgeProvider(true) },
  });
  assert.deepEqual(good.grading.summary, { passed: 1, failed: 0, total: 1, pass_rate: 1 });

  const badJudge = provider("not json");
  const bad = await gradeOutputs({
    modelOutput: "x",
    assertions: ["Must pass"],
    judge: { model: "judge", provider: badJudge },
  });
  assert.equal(bad.grading.summary.failed, 1);
  assert.match(bad.grading.assertion_results[0].evidence, /unparseable/);
});

test("buildBenchmark and ensureIterationDir follow spec shapes", () => {
  const benchmark = buildBenchmark([
    { mode: "with_skill", passRate: 1, durationMs: 1000, tokens: 10 },
    { mode: "without_skill", passRate: 0.5, durationMs: 2000, tokens: 5 },
  ]);
  assert.equal(benchmark.run_summary.delta.pass_rate, 0.5);
  assert.equal(benchmark.run_summary.with_skill.time_seconds.mean, 1);

  const root = tempRoot();
  assert.equal(ensureIterationDir(root).iteration, 1);
  assert.equal(ensureIterationDir(root).iteration, 2);
});

test("runEval supports complete-only provider fallback and writes artifacts", async () => {
  const root = tempRoot();
  const skill = loadSkill(writeSkill(root));
  const workspace = path.join(root, "workspace");
  const target = provider("Top revenue months: Jan");
  const result = await runEval({
    skill,
    eval: skill.evals[0],
    modes: ["with_skill", "without_skill"],
    target: { model: "target", provider: target },
    judge: { model: "judge", provider: judgeProvider(true) },
    workspace,
    iteration: 1,
  });
  assert.ok(target.prompts[0].includes("---USER REQUEST---"));
  assert.ok(target.prompts[0].includes("<file path=\"evals/files/data.csv\""));
  assert.ok(existsSync(path.join(workspace, "iteration-1", result.slug, "with_skill", "grading.json")));
  assert.ok(existsSync(path.join(workspace, "iteration-1", result.slug, "without_skill", "timing.json")));
});

test("evaluateSkills produces spec workspace layout and summary", async () => {
  const root = tempRoot();
  writeSkill(root);
  const workspace = path.join(root, "bench-workspace");
  const result = await evaluateSkills({
    root,
    workspace,
    baseline: true,
    target: { model: "target", provider: provider("Top revenue months: Jan") },
    judge: { model: "judge", provider: judgeProvider(true) },
  });
  assert.equal(result.failed, 0);
  assert.equal(result.skills.length, 1);
  const benchmark = JSON.parse(readFileSync(result.skills[0].benchmarkPath, "utf8"));
  assert.ok(benchmark.run_summary.with_skill);
  assert.ok(benchmark.run_summary.without_skill);
  assert.ok(existsSync(path.join(workspace, "csv-analyzer", "eval-top-months", "with_skill", "outputs")));
});
