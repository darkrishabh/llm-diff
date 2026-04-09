import type { Provider } from "./providers/base.js";
import type {
  Assertion,
  AssertionResult,
  ProviderResult,
  ProviderTestResult,
  SuiteConfig,
  SuiteResult,
  TestCaseResult,
  ProviderSummary,
} from "./types.js";
import { interpolate } from "./suite-loader.js";

// ─── Individual assertion runner ─────────────────────────────────────────────

async function runAssertion(
  assertion: Assertion,
  result: ProviderResult,
  judgeProvider?: Provider
): Promise<AssertionResult> {
  switch (assertion.type) {
    case "contains": {
      const pass = result.output.toLowerCase().includes(assertion.value.toLowerCase());
      return { type: "contains", pass, score: pass ? 1 : 0, reason: pass ? undefined : `Missing "${assertion.value}"` };
    }

    case "not-contains": {
      const pass = !result.output.toLowerCase().includes(assertion.value.toLowerCase());
      return { type: "not-contains", pass, score: pass ? 1 : 0, reason: pass ? undefined : `Should not contain "${assertion.value}"` };
    }

    case "latency": {
      const pass = result.latencyMs <= assertion.threshold;
      return {
        type: "latency",
        pass,
        score: pass ? 1 : 0,
        reason: pass ? undefined : `${result.latencyMs}ms exceeded threshold of ${assertion.threshold}ms`,
      };
    }

    case "cost": {
      const pass = result.costUsd <= assertion.threshold;
      return {
        type: "cost",
        pass,
        score: pass ? 1 : 0,
        reason: pass ? undefined : `$${result.costUsd.toFixed(6)} exceeded threshold of $${assertion.threshold}`,
      };
    }

    case "llm-rubric": {
      if (!judgeProvider) {
        return {
          type: "llm-rubric",
          pass: false,
          score: 0,
          reason: "No judge provider configured — set ANTHROPIC_API_KEY or pass --judge",
        };
      }
      if (result.error || !result.output) {
        return { type: "llm-rubric", pass: false, score: 0, reason: "No output to evaluate" };
      }
      try {
        const judgePrompt = [
          `You are an impartial evaluator. Assess whether the following response meets the criterion.`,
          ``,
          `Criterion: ${assertion.value}`,
          ``,
          `Response:`,
          result.output,
          ``,
          `Reply with exactly one word on the first line: PASS or FAIL.`,
          `Then on the next line, briefly explain why (one sentence).`,
        ].join("\n");

        const judgeResult = await judgeProvider.complete(judgePrompt);
        const lines = judgeResult.output.trim().split("\n");
        const verdict = lines[0].trim().toUpperCase();
        const pass = verdict.startsWith("PASS");
        return {
          type: "llm-rubric",
          pass,
          score: pass ? 1 : 0,
          reason: lines.slice(1).join(" ").trim() || undefined,
        };
      } catch (err) {
        return {
          type: "llm-rubric",
          pass: false,
          score: 0,
          reason: `Judge error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }
}

// ─── Suite runner ─────────────────────────────────────────────────────────────

export interface RunSuiteOptions {
  config: SuiteConfig;
  providers: Provider[];
  /** Optional provider used to evaluate llm-rubric assertions */
  judgeProvider?: Provider;
  /** Called after each test case completes — useful for progress reporting */
  onCaseComplete?: (caseResult: TestCaseResult, index: number, total: number) => void;
}

export async function runSuite({
  config,
  providers,
  judgeProvider,
  onCaseComplete,
}: RunSuiteOptions): Promise<SuiteResult> {
  const cases: TestCaseResult[] = [];
  const { prompts, tests } = config;

  // Each combination of prompt template × test case is one "case"
  const allCases: { promptTemplate: string; test: (typeof tests)[number] }[] = [];
  for (const promptTemplate of prompts) {
    for (const test of tests) {
      allCases.push({ promptTemplate, test });
    }
  }

  for (let i = 0; i < allCases.length; i++) {
    const { promptTemplate, test } = allCases[i];
    const vars = test.vars ?? {};
    const prompt = interpolate(promptTemplate, vars);
    const assertions = test.assert ?? [];

    // Fan out to all providers in parallel
    const providerResults = await Promise.all(
      providers.map(async (provider): Promise<ProviderTestResult> => {
        const result = await provider.complete(prompt);

        const assertionResults = await Promise.all(
          assertions.map((a) => runAssertion(a, result, judgeProvider))
        );

        const pass = assertionResults.length === 0 || assertionResults.every((a) => a.pass);
        const score =
          assertionResults.length === 0
            ? 1
            : assertionResults.reduce((sum, a) => sum + a.score, 0) / assertionResults.length;

        return { ...result, assertions: assertionResults, pass, score };
      })
    );

    const caseResult: TestCaseResult = {
      prompt,
      vars,
      providerResults,
      ranAt: new Date().toISOString(),
    };

    cases.push(caseResult);
    onCaseComplete?.(caseResult, i, allCases.length);
  }

  // Build per-provider summary
  const summaryMap = new Map<string, ProviderSummary>();

  for (const provider of providers) {
    const key = `${provider.name}/${provider.model}`;
    summaryMap.set(key, {
      provider: provider.name,
      model: provider.model,
      passed: 0,
      failed: 0,
      total: 0,
      score: 0,
      avgLatencyMs: 0,
      totalCostUsd: 0,
    });
  }

  for (const c of cases) {
    for (const pr of c.providerResults) {
      const key = `${pr.provider}/${pr.model}`;
      const s = summaryMap.get(key);
      if (!s) continue;
      s.total++;
      if (pr.pass) s.passed++; else s.failed++;
      s.avgLatencyMs += pr.latencyMs;
      s.totalCostUsd += pr.costUsd;
    }
  }

  const summary: ProviderSummary[] = [...summaryMap.values()].map((s) => ({
    ...s,
    score: s.total > 0 ? s.passed / s.total : 0,
    avgLatencyMs: s.total > 0 ? Math.round(s.avgLatencyMs / s.total) : 0,
  }));

  return { cases, summary };
}
