# Prompt-Diff on npm

**Status:** `@prompt-diff/core` and `@prompt-diff/cli` are published on the public registry (verified April 2026).

## Packages


| Package                 | Version | npm                                                                                    |
| ----------------------- | ------- | -------------------------------------------------------------------------------------- |
| `**@prompt-diff/core`** | 0.1.3   | [npmjs.com/package/@prompt-diff/core](https://www.npmjs.com/package/@prompt-diff/core) |
| `**@prompt-diff/cli**`  | 0.1.3   | [npmjs.com/package/@prompt-diff/cli](https://www.npmjs.com/package/@prompt-diff/cli)   |


The CLI exposes the `**prompt-diff**` binary (global install: `npm i -g @prompt-diff/cli`).

## Install

```bash
# One-off run
npx @prompt-diff/cli "Your prompt" --models claude,ollama

# Library
npm install @prompt-diff/core
```

```ts
import { runDiff, runSuite } from "@prompt-diff/core";
```

## Registry check

From any machine:

```bash
npm view @prompt-diff/core version
npm view @prompt-diff/cli version
```

Expect the latest from `npm view` (e.g. `0.1.3`) after each release.

## Naming notes

- The unscoped name `prompt-diff` is **not** used on npm (too similar to the existing `promptdiff` package).
- Scoped packages live under the `**prompt-diff`** npm org: `@prompt-diff/cli`, `@prompt-diff/core`.

## Links

- **Repo:** [github.com/darkrishabh/prompt-diff](https://github.com/darkrishabh/prompt-diff)
- **Hosted UI:** [prompt-diff-oss.vercel.app](https://prompt-diff-oss.vercel.app/)

