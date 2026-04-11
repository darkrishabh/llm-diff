# Prompt-Diff

One prompt, many models — compare quality, speed, and cost.

[npm CLI](https://www.npmjs.com/package/@prompt-diff/cli)
[npm core](https://www.npmjs.com/package/@prompt-diff/core)
[License: MIT](./LICENSE)
[Node.js](https://nodejs.org)
[Live demo](https://prompt-diff-oss.vercel.app/)
[GitHub](https://github.com/darkrishabh/prompt-diff)

**[Live demo →](https://prompt-diff-oss.vercel.app/)**  ·  [Quick start](#quick-start)  ·  [Web UI](#web-ui)  ·  [CLI](#cli-usage)  ·  [Providers](#providers)  ·  [Eval suites](#eval-suites-yaml)  ·  [Architecture](#architecture)  ·  [npm packages](docs/blog/npm-packages.md)

---

**Prompt-Diff** runs **one prompt against many LLMs** and lines up answers, latency, tokens, and cost in a **CLI** (npm package `**@prompt-diff/cli`**, command `**prompt-diff`** when installed globally) and a **Next.js** web UI — so you can compare providers with evidence instead of juggling tabs and copy-paste.

```bash
npx @prompt-diff/cli "Explain the CAP theorem in one paragraph" --models claude,ollama
```

Works on **macOS**, **Linux**, and **Windows** with **Node.js 18+**.

---

## Table of contents

- [Why Prompt-Diff?](#why-prompt-diff)
- [Features](#features)
- [Quick start](#quick-start)
- [Providers](#providers)
- [Configuration](#configuration)
- [Eval suites (YAML)](#eval-suites-yaml)
- [Web UI](#web-ui)
- [CLI usage](#cli-usage)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [npm packages (blog)](docs/blog/npm-packages.md)
- [License](#license)

---

## Why Prompt-Diff?

Picking the right model shouldn't mean mentally mapping *which output came from where*. Prompt-Diff keeps every model's answer and metrics in one place so you can decide with data.

> **Tip:** Use the **CLI** in CI and scripts (`--output json`). Use the **web app** when you want a polished compare view, YAML test suites, and judge-backed rubrics — without restarting the server when you change models.

---

## Features


|                          |                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Side-by-side compare** | Same prompt, every enabled model — outputs, errors, and metrics in one grid.                                                       |
| **YAML eval suites**     | Prompt templates × variable matrices × assertions (`contains`, `latency`, `cost`, `llm-rubric`).                                   |
| **Live suite logs**      | Streamed run log in the web UI so you see each LLM and judge call as it happens.                                                   |
| **OpenAI model list**    | With an API key, the UI loads chat models from OpenAI's `/v1/models` (plus presets & "Other").                                     |
| **Secrets & judge**      | Web settings for secret variables, Anthropic/Ollama judge, and YAML import/export.                                                 |
| **CLI + core library**   | `npx @prompt-diff/cli` (or `npm i -g @prompt-diff/cli` then `prompt-diff`); `@prompt-diff/core` for programmatic diffs and suites. |


---

## Quick start

### CLI — zero install

```bash
ANTHROPIC_API_KEY=sk-... npx @prompt-diff/cli "What is LoRA?"

npx @prompt-diff/cli "Review this function" --file ./utils.py --models claude,ollama

# Average latency over 5 runs
npx @prompt-diff/cli "Summarize this" --runs 5 --output json
```

### Web UI — hosted

Open **[https://prompt-diff-oss.vercel.app/](https://prompt-diff-oss.vercel.app/)**. Add API keys under **Settings** in the browser; test suites live at `/suite`.

### Web UI — local dev

```bash
git clone https://github.com/darkrishabh/prompt-diff
cd prompt-diff
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) (or `3001` if 3000 is busy).

> **Note:** Suite streaming and eval need a Node deployment (not `output: 'export'`). The suite API sets a long `maxDuration` for hosts like Vercel; very heavy runs may still need a higher limit or a long-lived server.

### Deploying on Vercel

Required settings or you'll get a plain `NOT_FOUND` on `*.vercel.app`:

1. **Root Directory** → set to `packages/web` (not `.` and not empty).
2. **Build Command** → leave empty (uses `packages/web/vercel.json: npm run build`) or set explicitly to `npm run build`. Do not use `next build` only — it skips compiling `@prompt-diff/core`.
3. **Install** → default `npm install` from the repository root is correct for npm workspaces.
4. **Include files outside Root Directory** → leave enabled so `packages/core` is visible during the build.

`packages/web/next.config.ts` sets `outputFileTracingRoot` to the monorepo root so API routes bundle correctly.

---

## Providers

### Cloud APIs


| Provider       | Env var                                | Notes                           |
| -------------- | -------------------------------------- | ------------------------------- |
| **Claude**     | `ANTHROPIC_API_KEY`                    | Haiku, Sonnet, Opus             |
| **OpenAI**     | `OPENAI_API_KEY`                       | Full list in UI when key is set |
| **Groq**       | `GROQ_API_KEY`                         | Very fast inference             |
| **OpenRouter** | `OPENROUTER_API_KEY`                   | Many models, one key            |
| **Together**   | `TOGETHER_API_KEY`                     | Open-weight models              |
| **NVIDIA NIM** | `NVIDIA_NIM_API_KEY`                   | NIM endpoints                   |
| **Perplexity** | `PERPLEXITY_API_KEY`                   | Search-grounded                 |
| **Minimax**    | `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` | API + group ID                  |
| **Custom**     | —                                      | Any OpenAI-compatible base URL  |


### Local & CLI


| Provider       | Requirements                                                             |
| -------------- | ------------------------------------------------------------------------ |
| **Ollama**     | [ollama.ai](https://ollama.ai) — local tags discovered via `/api/models` |
| **Claude CLI** | `@anthropic-ai/claude-code` on `PATH`                                    |
| **Codex CLI**  | `@openai/codex` on `PATH`                                                |
| **LM Studio**  | OpenAI-compatible server (e.g. `localhost:1234`) via **Custom**          |


---

## Configuration

Copy `.env.example` to `.env.local` for the web app, or export vars in your shell for the CLI.

```bash
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434   # optional

OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
TOGETHER_API_KEY=...
NVIDIA_NIM_API_KEY=nvapi-...
PERPLEXITY_API_KEY=pplx-...

MINIMAX_API_KEY=...
MINIMAX_GROUP_ID=...
```

---

## Eval suites (YAML)

Define prompt templates, test rows (`vars`), and assertions: `contains`, `not-contains`, `latency`, `cost`, and `llm-rubric` (needs a judge — Claude when a key is available, or `--judge ollama` / `none`).

Full example: `[examples/prompt-diff.yaml](examples/prompt-diff.yaml)`

```bash
npx @prompt-diff/cli run --config examples/prompt-diff.yaml --models claude,ollama,minimax
npx @prompt-diff/cli run --config examples/prompt-diff.yaml --output json --fail-on-error
npx @prompt-diff/cli run --config examples/prompt-diff.yaml --judge none
```

With a global install (`npm i -g @prompt-diff/cli`), use `prompt-diff` instead of `npx @prompt-diff/cli`.

The web app runs the same engine at `POST /api/suite` with SSE live logs when `stream: true`.

---

## Web UI


| Capability           | Description                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Run workspace**    | Prompt card, colored model chips, **+ add model**, **Run**, then **Responses / Compare & evaluate / History**                                  |
| **Responses**        | **Grid** (wrapping cards, 4+ models), **Side-by-side** (horizontal scroll), or **Diff** (line-level LCS between two outputs)                   |
| **Model cards**      | Provider label, model ID, highlight pills (fastest / slowest / cheapest / best rated), 3-column metrics, markdown body, star rating + **Copy** |
| **Quick comparison** | Sticky footer mini-bars for latency, output tokens, and cost; **Full compare** jumps to the evaluate tab                                       |
| **History**          | Last runs stored in `localStorage`; click an entry to reload prompt + results                                                                  |
| **Test suites**      | `/suite` — YAML editor, run target banner, judge summary, live log, matrix results, recent runs (last 15, browser `localStorage`)              |
| **Settings**         | Models, secrets, judge, YAML import/export — stored in `localStorage`                                                                          |
| **API routes**       | `/api/diff`, `/api/suite`, `/api/models` (Ollama GET, OpenAI POST)                                                                             |


---

## CLI usage

The on-disk command is `**prompt-diff`** after `npm i -g @prompt-diff/cli`; with `npx`, call `**npx @prompt-diff/cli`** instead.

```
Usage: prompt-diff <prompt> [options]

Arguments:
  prompt                     Prompt to send to all providers

Options:
  --file <path>              Append file contents to the prompt
  --models <list>            Comma-separated providers (default: "claude,ollama")
  --runs <n>                 Runs for latency averaging (default: 1)
  --output <format>          pretty | json (default: "pretty")
  -V, --version              Show version
  -h, --help                 Show help
```

```bash
prompt-diff "Implement binary search in Python" --models claude,ollama
prompt-diff "Hello" --models groq,claude --runs 10 --output json | jq '.results[].latencyMs'
prompt-diff "Find bugs" --file ./server.ts
prompt-diff "Explain recursion" --models claude-cli,codex
```

---

## Architecture

```mermaid
flowchart LR
  subgraph clients [Clients]
    CLI[CLI / Ink]
    WEB[Next.js UI]
  end

  subgraph pkg [packages]
    CORE["@prompt-diff/core\nrunDiff · runSuite · providers"]
    API[API routes]
  end

  CLI --> CORE
  WEB --> API
  API --> CORE
  CORE --> P1[Claude / Ollama / OpenAI-compat …]
```




| Package                             | Role                                                               |
| ----------------------------------- | ------------------------------------------------------------------ |
| `packages/core`                     | `Provider` interface, `runDiff`, `runSuite`, YAML parsing, pricing |
| `packages/cli` (`@prompt-diff/cli`) | Commander + terminal UI; `**prompt-diff**` binary                  |
| `packages/web`                      | Next.js App Router, streaming suite API, model discovery proxy     |


**Adding a provider** is on the order of tens of lines: implement `Provider` in core and wire it in the web API (and CLI config if needed). `OpenAICompatibleProvider` covers most REST APIs; subprocess adapters cover local CLIs.

---

## Contributing

```bash
git clone https://github.com/darkrishabh/prompt-diff.git
cd prompt-diff
npm install
npm run dev          # turbo: CLI watch + Next dev
npm run build
npm run type-check
```

If your local `origin` still uses the old repository name:

```bash
git remote set-url origin https://github.com/darkrishabh/prompt-diff.git
```

Ideas that move the needle: new providers (Gemini, Bedrock, Azure OpenAI), richer diff UX, terminal markdown, tighter CI eval stories.

---

## License

MIT — see [LICENSE](./LICENSE).

Built by [@darkrishabh](https://github.com/darkrishabh)