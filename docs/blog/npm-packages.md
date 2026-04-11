# Bench AI on npm (`benchai`)

**Last updated:** April 2026  

**Bench AI** ships as the unscoped npm package **`benchai`**. (The name `bench-ai` is registered to another project on the registry.)

| What | How |
|---|---|
| **CLI** | `npx benchai` or `npm i -g benchai` → binary **`benchai`** |
| **Programmatic API** | `import { runDiff, runSuite, … } from "benchai"` |
| **Web UI (local)** | `benchai web` |
| **Web UI (hosted)** | [bench-ai-web.vercel.app](https://bench-ai-web.vercel.app/) |

```bash
npx benchai "Your prompt" --models claude,ollama
npx benchai run --config examples/smoke.yaml
npx benchai web
```

```bash
npm install benchai
```

```ts
import { runDiff, runSuite } from "benchai";
```

```bash
npm view benchai version
```

- **Repo:** [github.com/darkrishabh/bench-ai](https://github.com/darkrishabh/bench-ai)  
- **Vercel:** Root Directory **repository root** (`.`)

Legacy **`@prompt-diff/cli`** / **`@prompt-diff/core`** → **`benchai`**. See [migrating-from-prompt-diff.md](./migrating-from-prompt-diff.md).
