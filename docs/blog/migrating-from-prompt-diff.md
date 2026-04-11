# Migrating from Prompt-Diff to Bench AI

**Last updated:** April 2026  

Bench AI replaces **`@prompt-diff/core`**, **`@prompt-diff/cli`**, and **`packages/web`** with one npm package: **`benchai`**.

## npm and CLI

| Before | After |
|---|---|
| `npx @prompt-diff/cli …` | `npx benchai …` |
| `npm i -g @prompt-diff/cli` → binary `prompt-diff` | `npm i -g benchai` → binary `benchai` |
| `prompt-diff run --config …` | `benchai run --config …` |

Run the bundled UI with **`benchai web`** (or deploy from this repo).

## TypeScript / Node imports

| Before | After |
|---|---|
| `import { runSuite } from "@prompt-diff/core"` | `import { runSuite } from "benchai"` |

## Example suites

| Before | After |
|---|---|
| `examples/prompt-diff.yaml` | `examples/bench-ai.yaml` |

Example file comments use **`npx benchai run …`**.

## Browser storage (web UI)

Runtime keys stay under **`bench-ai:*`** (product namespace), with migration from **`prompt-diff:*`** and **`llm-diff:*`**.

## Links

- **Repository:** [github.com/darkrishabh/bench-ai](https://github.com/darkrishabh/bench-ai)  
- **Vercel:** Root Directory **repository root**
