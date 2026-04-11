import { load } from "js-yaml";
import { dump } from "js-yaml";
import type { AppConfigYaml, JudgeSettings, LLMInstance, SecretsMap } from "../types";
import { APP_CONFIG_VERSION, DEFAULT_JUDGE_SETTINGS } from "../types";

export function exportAppConfigYaml(params: {
  secrets: SecretsMap;
  judge: JudgeSettings;
  instances: LLMInstance[];
}): string {
  const doc: AppConfigYaml = {
    version: APP_CONFIG_VERSION,
    secrets: { ...params.secrets },
    judge: { ...params.judge },
    instances: params.instances.map((i) => ({ ...i })),
  };
  return dump(doc, { lineWidth: 120, noRefs: true, quotingType: '"' });
}

export function parseAppConfigYaml(yaml: string): AppConfigYaml {
  const raw = load(yaml) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("Config must be a YAML mapping");
  }
  const o = raw as Record<string, unknown>;
  const version = typeof o.version === "number" ? o.version : 1;
  if (version !== APP_CONFIG_VERSION) {
    throw new Error(`Unsupported config version: ${version} (expected ${APP_CONFIG_VERSION})`);
  }

  const secrets: SecretsMap =
    o.secrets && typeof o.secrets === "object" && o.secrets !== null && !Array.isArray(o.secrets)
      ? Object.fromEntries(
          Object.entries(o.secrets as Record<string, unknown>).filter(
            ([, v]) => typeof v === "string"
          ) as [string, string][]
        )
      : {};

  let judge: Partial<JudgeSettings> | undefined;
  if (o.judge && typeof o.judge === "object" && o.judge !== null && !Array.isArray(o.judge)) {
    judge = o.judge as Partial<JudgeSettings>;
  }

  let instances: LLMInstance[] | undefined;
  if (Array.isArray(o.instances)) {
    instances = o.instances.filter(
      (x): x is LLMInstance =>
        x !== null &&
        typeof x === "object" &&
        typeof (x as LLMInstance).id === "string" &&
        typeof (x as LLMInstance).provider === "string" &&
        typeof (x as LLMInstance).model === "string" &&
        typeof (x as LLMInstance).enabled === "boolean"
    );
  }

  return { version, secrets, judge, instances };
}

export function mergeImportedConfig(
  parsed: AppConfigYaml,
  current: { secrets: SecretsMap; judge: JudgeSettings; instances: LLMInstance[] }
): { secrets: SecretsMap; judge: JudgeSettings; instances: LLMInstance[] } {
  return {
    secrets: { ...current.secrets, ...(parsed.secrets ?? {}) },
    judge: { ...DEFAULT_JUDGE_SETTINGS, ...current.judge, ...(parsed.judge ?? {}) },
    instances: Array.isArray(parsed.instances) ? parsed.instances : current.instances,
  };
}
