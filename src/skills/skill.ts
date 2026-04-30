import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import type {
  AgentSkillsEval,
  AttachedFile,
  Skill,
  SkillDefaults,
  ToolAssertion,
  ToolChoice,
  ToolDef,
} from "./types.js";
import { isInsideDir, pathToPosix, readAttachedFile } from "./fs-utils.js";
export type { AgentSkillsEval, AttachedFile, Skill } from "./types.js";

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

interface RawEvalsJson {
  skill_name?: unknown;
  defaults?: unknown;
  evals?: unknown;
}

const TOOL_ASSERTION_TYPES = new Set([
  "tool-called",
  "tool-not-called",
  "tool-arg-equals",
  "tool-arg-contains",
  "tool-arg-matches",
  "tool-call-count",
] as const);

const REFERENCE_EXTENSIONS = new Set([".md", ".mdx"]);

function splitFrontmatter(markdown: string): { frontmatter: SkillFrontmatter; body: string } {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return { frontmatter: {}, body: markdown.trim() };
  }

  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: {}, body: markdown.trim() };
  }

  const parsed = load(match[1]) as unknown;
  const record =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return {
    frontmatter: {
      name: typeof record.name === "string" ? record.name : undefined,
      description: typeof record.description === "string" ? record.description : undefined,
    },
    body: markdown.slice(match[0].length).trim(),
  };
}

function walkFiles(root: string, predicate: (filePath: string) => boolean): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && predicate(fullPath)) {
        out.push(fullPath);
      }
    }
  };
  visit(root);
  return out.sort((a, b) => pathToPosix(path.relative(root, a)).localeCompare(pathToPosix(path.relative(root, b))));
}

function readReferences(skillDir: string, maxFileBytes: number): AttachedFile[] {
  const referencesDir = path.join(skillDir, "references");
  return walkFiles(referencesDir, (filePath) => REFERENCE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => readAttachedFile(skillDir, path.relative(skillDir, filePath), maxFileBytes));
}

function readScripts(skillDir: string, maxFileBytes: number, includeScriptBodies: boolean): AttachedFile[] {
  const scriptsDir = path.join(skillDir, "scripts");
  if (!existsSync(scriptsDir)) return [];
  return readdirSync(scriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const relPath = path.join("scripts", entry.name);
      if (includeScriptBodies) return readAttachedFile(skillDir, relPath, maxFileBytes);
      const fullPath = path.join(skillDir, relPath);
      const stat = statSync(fullPath);
      const firstLine = readFileSync(fullPath, "utf8").split(/\r?\n/, 1)[0] ?? "";
      const manifest: AttachedFile = {
        path: pathToPosix(relPath),
        content: firstLine.startsWith("#!") ? firstLine : "",
        kind: "text",
        bytes: stat.size,
      };
      return manifest;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function parseParams(value: unknown, where: string): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${where}.params must be an object of inference parameters`);
  }
  return value as Record<string, unknown>;
}

function parseTool(entry: unknown, where: string): ToolDef {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`${where} must be an object`);
  }
  const r = entry as Record<string, unknown>;
  if (r.type !== "function") {
    throw new Error(`${where}.type must be "function"`);
  }
  if (!r.function || typeof r.function !== "object" || Array.isArray(r.function)) {
    throw new Error(`${where}.function must be an object`);
  }
  const fn = r.function as Record<string, unknown>;
  if (typeof fn.name !== "string" || fn.name.length === 0) {
    throw new Error(`${where}.function.name is required`);
  }
  return {
    type: "function",
    function: {
      name: fn.name,
      description: typeof fn.description === "string" ? fn.description : undefined,
      parameters:
        fn.parameters && typeof fn.parameters === "object" && !Array.isArray(fn.parameters)
          ? (fn.parameters as Record<string, unknown>)
          : undefined,
    },
  };
}

function parseTools(value: unknown, where: string): ToolDef[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${where}.tools must be an array`);
  return value.map((entry, index) => parseTool(entry, `${where}.tools[${index}]`));
}

function parseToolChoice(value: unknown, where: string): ToolChoice | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "auto" || value === "none" || value === "required") return value;
  if (typeof value === "object" && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if (v.type === "function" && v.function && typeof v.function === "object") {
      const fn = v.function as Record<string, unknown>;
      if (typeof fn.name === "string" && fn.name.length > 0) {
        return { type: "function", function: { name: fn.name } };
      }
    }
  }
  throw new Error(`${where}.tool_choice must be "auto", "none", "required", or {type:"function",function:{name}}`);
}

function parseToolAssertion(entry: unknown, where: string): ToolAssertion {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`${where} must be an object`);
  }
  const r = entry as Record<string, unknown>;
  const type = r.type;
  if (typeof type !== "string" || !TOOL_ASSERTION_TYPES.has(type as (typeof TOOL_ASSERTION_TYPES) extends Set<infer U> ? U : never)) {
    throw new Error(`${where}.type must be one of: ${[...TOOL_ASSERTION_TYPES].join(", ")}`);
  }
  const desc = typeof r.description === "string" ? r.description : undefined;
  const name = typeof r.name === "string" ? r.name : undefined;

  switch (type) {
    case "tool-called":
    case "tool-not-called": {
      if (!name) throw new Error(`${where}.name is required for ${type}`);
      return { type, name, description: desc };
    }
    case "tool-arg-equals": {
      if (!name) throw new Error(`${where}.name is required`);
      if (typeof r.path !== "string" || r.path.length === 0) {
        throw new Error(`${where}.path is required`);
      }
      return { type, name, path: r.path, value: r.value, description: desc };
    }
    case "tool-arg-contains": {
      if (!name) throw new Error(`${where}.name is required`);
      if (typeof r.path !== "string" || r.path.length === 0) {
        throw new Error(`${where}.path is required`);
      }
      if (typeof r.value !== "string") {
        throw new Error(`${where}.value must be a string for tool-arg-contains`);
      }
      return { type, name, path: r.path, value: r.value, description: desc };
    }
    case "tool-arg-matches": {
      if (!name) throw new Error(`${where}.name is required`);
      if (typeof r.path !== "string" || r.path.length === 0) {
        throw new Error(`${where}.path is required`);
      }
      if (typeof r.pattern !== "string") {
        throw new Error(`${where}.pattern (regex string) is required`);
      }
      return {
        type,
        name,
        path: r.path,
        pattern: r.pattern,
        flags: typeof r.flags === "string" ? r.flags : undefined,
        description: desc,
      };
    }
    case "tool-call-count": {
      const min = typeof r.min === "number" ? r.min : undefined;
      const max = typeof r.max === "number" ? r.max : undefined;
      if (min === undefined && max === undefined) {
        throw new Error(`${where} requires at least one of min or max`);
      }
      return { type, name, min, max, description: desc };
    }
    default:
      throw new Error(`${where}: unhandled tool assertion type ${type}`);
  }
}

function parseToolAssertions(value: unknown, where: string): ToolAssertion[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${where}.tool_assertions must be an array`);
  return value.map((entry, index) => parseToolAssertion(entry, `${where}.tool_assertions[${index}]`));
}

function parseEval(entry: unknown, evalIndex: number): AgentSkillsEval {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Each Agent Skills eval must be an object");
  }
  const record = entry as Record<string, unknown>;
  const prompt = record.prompt;
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new Error("Each Agent Skills eval requires a prompt string");
  }
  const where = `evals[${evalIndex}]`;
  return {
    id: typeof record.id === "string" || typeof record.id === "number" ? record.id : undefined,
    name: typeof record.name === "string" ? record.name : undefined,
    prompt,
    expected_output: typeof record.expected_output === "string" ? record.expected_output : undefined,
    files: Array.isArray(record.files) ? record.files.filter((file): file is string => typeof file === "string") : undefined,
    assertions: Array.isArray(record.assertions)
      ? record.assertions.filter((assertion): assertion is string => typeof assertion === "string")
      : undefined,
    params: parseParams(record.params, where),
    tools: parseTools(record.tools, where),
    tool_choice: parseToolChoice(record.tool_choice, where),
    tool_assertions: parseToolAssertions(record.tool_assertions, where),
  };
}

function parseDefaults(value: unknown): SkillDefaults | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("defaults must be an object");
  }
  const r = value as Record<string, unknown>;
  const targetParams =
    r.target && typeof r.target === "object" && !Array.isArray(r.target)
      ? parseParams((r.target as Record<string, unknown>).params, "defaults.target")
      : undefined;
  const judgeParams =
    r.judge && typeof r.judge === "object" && !Array.isArray(r.judge)
      ? parseParams((r.judge as Record<string, unknown>).params, "defaults.judge")
      : undefined;
  const tools = parseTools(r.tools, "defaults");

  if (targetParams === undefined && judgeParams === undefined && tools === undefined) {
    return undefined;
  }
  return {
    target: targetParams ? { params: targetParams } : undefined,
    judge: judgeParams ? { params: judgeParams } : undefined,
    tools,
  };
}

function readEvalsFile(skillDir: string): { evals: AgentSkillsEval[]; defaults?: SkillDefaults } {
  const evalsPath = path.join(skillDir, "evals", "evals.json");
  if (!existsSync(evalsPath)) return { evals: [] };
  const parsed = JSON.parse(readFileSync(evalsPath, "utf8")) as RawEvalsJson;
  if (!Array.isArray(parsed.evals)) {
    throw new Error(`${evalsPath} must contain an evals array`);
  }
  return {
    evals: parsed.evals.map((entry, index) => parseEval(entry, index)),
    defaults: parseDefaults(parsed.defaults),
  };
}

export function loadSkill(
  skillDir: string,
  opts: { maxFileBytes?: number; includeScriptBodies?: boolean } = {}
): Skill {
  const dir = path.resolve(skillDir);
  const skillPath = path.join(dir, "SKILL.md");
  if (!existsSync(skillPath)) {
    throw new Error(`Skill directory must contain SKILL.md: ${dir}`);
  }

  const maxFileBytes = opts.maxFileBytes ?? 64 * 1024;
  const { frontmatter, body } = splitFrontmatter(readFileSync(skillPath, "utf8"));
  const evalFilesDir = path.join(dir, "evals", "files");

  if (existsSync(evalFilesDir) && !isInsideDir(dir, evalFilesDir)) {
    throw new Error(`Invalid evals files directory: ${evalFilesDir}`);
  }

  const { evals, defaults } = readEvalsFile(dir);

  return {
    name: frontmatter.name?.trim() || path.basename(dir),
    description: frontmatter.description?.trim() || undefined,
    dir,
    skillMd: body,
    references: readReferences(dir, maxFileBytes),
    scripts: readScripts(dir, maxFileBytes, opts.includeScriptBodies ?? false),
    evals,
    evalFilesDir: existsSync(evalFilesDir) ? evalFilesDir : undefined,
    defaults,
  };
}

