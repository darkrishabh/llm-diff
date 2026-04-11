import { load } from "js-yaml";
import type { SuiteConfig, Assertion, TestCase } from "./types.js";

/**
 * Interpolate {{varName}} placeholders in a template string.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Parse a YAML string into a validated SuiteConfig.
 * Throws a descriptive error if required fields are missing.
 */
export function parseSuiteConfig(yaml: string): SuiteConfig {
  const raw = load(yaml) as Record<string, unknown>;

  if (!raw || typeof raw !== "object") {
    throw new Error("Suite config must be a YAML object");
  }

  if (!Array.isArray(raw.prompts) || raw.prompts.length === 0) {
    throw new Error("Suite config must have at least one entry under `prompts`");
  }

  if (!Array.isArray(raw.tests) || raw.tests.length === 0) {
    throw new Error("Suite config must have at least one entry under `tests`");
  }

  const prompts: string[] = raw.prompts.map((p: unknown, i: number) => {
    if (typeof p !== "string") throw new Error(`prompts[${i}] must be a string`);
    return p;
  });

  const tests: TestCase[] = (raw.tests as unknown[]).map((t: unknown, i: number) => {
    if (typeof t !== "object" || t === null) {
      throw new Error(`tests[${i}] must be an object`);
    }
    const tc = t as Record<string, unknown>;
    const vars = (tc.vars ?? {}) as Record<string, string>;
    const assert = tc.assert
      ? validateAssertions(tc.assert as unknown[], i)
      : undefined;
    return { vars, assert };
  });

  return { prompts, tests };
}

function validateAssertions(raw: unknown[], testIdx: number): Assertion[] {
  return raw.map((a: unknown, i: number) => {
    if (typeof a !== "object" || a === null) {
      throw new Error(`tests[${testIdx}].assert[${i}] must be an object`);
    }
    const obj = a as Record<string, unknown>;
    const type = obj.type as string;

    switch (type) {
      case "contains":
      case "not-contains":
        if (typeof obj.value !== "string") {
          throw new Error(`tests[${testIdx}].assert[${i}]: "${type}" requires a string "value"`);
        }
        return { type, value: obj.value } as Assertion;

      case "llm-rubric":
        if (typeof obj.value !== "string") {
          throw new Error(`tests[${testIdx}].assert[${i}]: "llm-rubric" requires a string "value" (the criterion)`);
        }
        return { type: "llm-rubric", value: obj.value } as Assertion;

      case "latency":
        if (typeof obj.threshold !== "number") {
          throw new Error(`tests[${testIdx}].assert[${i}]: "latency" requires a numeric "threshold" (ms)`);
        }
        return { type: "latency", threshold: obj.threshold } as Assertion;

      case "cost":
        if (typeof obj.threshold !== "number") {
          throw new Error(`tests[${testIdx}].assert[${i}]: "cost" requires a numeric "threshold" (USD)`);
        }
        return { type: "cost", threshold: obj.threshold } as Assertion;

      default:
        throw new Error(`tests[${testIdx}].assert[${i}]: unknown assertion type "${type}"`);
    }
  });
}
