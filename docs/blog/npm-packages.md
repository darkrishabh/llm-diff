# Bench AI on npm

**Status:** The unified package **`bench-ai`** is the public CLI, programmatic API, and web UI entrypoint (publish as a single package).

| Package / command | Notes |
|---|---|
| **`bench-ai`** | `npx bench-ai`, `npm i -g bench-ai` — binary **`bench-ai`** |
| **Programmatic** | `import { runDiff, runSuite, … } from "bench-ai"` (engine API from published `dist/`) |

## Commands

```bash
npx bench-ai "Your prompt" --models claude,ollama

npx bench-ai run --config examples/smoke.yaml --models claude,ollama

npx bench-ai web
```

`bench-ai web` starts the Next.js dev server for the bundled UI (same package).

## Library usage

```bash
npm install bench-ai
```

```ts
import { runDiff, runSuite } from "bench-ai";
```

## Verify published version

```bash
npm view bench-ai version
```

## Notes

- **Repo:** [github.com/darkrishabh/bench-ai](https://github.com/darkrishabh/bench-ai)
- **Hosted UI:** [bench-ai-web.vercel.app](https://bench-ai-web.vercel.app/) (set Vercel **Root Directory** to `packages/bench-ai`)

Legacy scoped packages `@prompt-diff/cli` and `@prompt-diff/core` are superseded by **`bench-ai`**.
