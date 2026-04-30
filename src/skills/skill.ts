import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import type { AgentSkillsEval, AttachedFile, Skill } from "./types.js";
import { isInsideDir, pathToPosix, readAttachedFile } from "./fs-utils.js";
export type { AgentSkillsEval, AttachedFile, Skill } from "./types.js";

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

interface RawEvalsJson {
  skill_name?: unknown;
  evals?: unknown;
}

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

function parseEval(entry: unknown): AgentSkillsEval {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Each Agent Skills eval must be an object");
  }
  const record = entry as Record<string, unknown>;
  const prompt = record.prompt;
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new Error("Each Agent Skills eval requires a prompt string");
  }
  return {
    id: typeof record.id === "string" || typeof record.id === "number" ? record.id : undefined,
    name: typeof record.name === "string" ? record.name : undefined,
    prompt,
    expected_output: typeof record.expected_output === "string" ? record.expected_output : undefined,
    files: Array.isArray(record.files) ? record.files.filter((file): file is string => typeof file === "string") : undefined,
    assertions: Array.isArray(record.assertions)
      ? record.assertions.filter((assertion): assertion is string => typeof assertion === "string")
      : undefined,
  };
}

function readEvals(skillDir: string): AgentSkillsEval[] {
  const evalsPath = path.join(skillDir, "evals", "evals.json");
  if (!existsSync(evalsPath)) return [];
  const parsed = JSON.parse(readFileSync(evalsPath, "utf8")) as RawEvalsJson;
  if (!Array.isArray(parsed.evals)) {
    throw new Error(`${evalsPath} must contain an evals array`);
  }
  return parsed.evals.map(parseEval);
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

  return {
    name: frontmatter.name?.trim() || path.basename(dir),
    description: frontmatter.description?.trim() || undefined,
    dir,
    skillMd: body,
    references: readReferences(dir, maxFileBytes),
    scripts: readScripts(dir, maxFileBytes, opts.includeScriptBodies ?? false),
    evals: readEvals(dir),
    evalFilesDir: existsSync(evalFilesDir) ? evalFilesDir : undefined,
  };
}

