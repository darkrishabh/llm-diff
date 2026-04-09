# llm-diff

**Run the same prompt across multiple LLMs simultaneously. Compare outputs, latency, tokens, and cost side-by-side.**

```
npx llm-diff "Explain the CAP theorem in one paragraph" --models claude,ollama
```

![llm-diff demo](docs/demo.gif)

---

## Why

Choosing the right model for a task means running experiments — but most tools make you bounce between tabs, copy-paste outputs, and mentally track which response came from which model. `llm-diff` pins all of that on one screen.

- **CLI** — pipe into your existing workflow, output JSON for scripting
- **Web UI** — self-hosted side-by-side diff with history, good for sharing with a team
- **Open provider model** — OpenAI-compatible endpoint? It works. Local CLI tool like Claude Code or Codex? It works.

---

## Quick Start

### CLI

```bash
# One-off (no install)
ANTHROPIC_API_KEY=sk-... npx llm-diff "What is LoRA?"

# Specific models
npx llm-diff "Review this function" --file ./utils.py --models claude,ollama

# Average over 5 runs (good for latency benchmarking)
npx llm-diff "Summarize this" --runs 5 --output json
```

### Web UI

```bash
git clone https://github.com/darkrishabh/llm-diff
cd llm-diff
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure providers in the **Configure** tab — no restart needed.

### Docker

```bash
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-... \
  ghcr.io/darkrishabh/llm-diff
```

---

## Providers

### API Providers

| Provider | Env Var | Notes |
|----------|---------|-------|
| **Claude** (Anthropic) | `ANTHROPIC_API_KEY` | claude-3-5-haiku, claude-3-5-sonnet, claude-opus |
| **OpenAI** | `OPENAI_API_KEY` | gpt-4o, gpt-4o-mini, o1, o3-mini |
| **Groq** | `GROQ_API_KEY` | llama-3.3-70b, mixtral, gemma2 — very fast inference |
| **OpenRouter** | `OPENROUTER_API_KEY` | 200+ models via one key |
| **Together AI** | `TOGETHER_API_KEY` | Open-source models |
| **NVIDIA NIM** | `NVIDIA_NIM_API_KEY` | Llama 3.1 405B, Nemotron |
| **Perplexity** | `PERPLEXITY_API_KEY` | Web-connected models |
| **Minimax** | `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` | Chinese frontier model |
| **Custom** | — | Any OpenAI-compatible endpoint |

### Local Providers

| Provider | Requirements | Notes |
|----------|-------------|-------|
| **Ollama** | [ollama.ai](https://ollama.ai) running locally | llama3, mistral, codellama, phi3, gemma2, qwen2.5 |
| **Claude CLI** | `npm i -g @anthropic-ai/claude-code` | Calls the local `claude` CLI subprocess |
| **OpenAI Codex CLI** | `npm i -g @openai/codex` | Calls the local `codex` CLI subprocess |
| **LM Studio** | LM Studio server running | OpenAI-compatible, point at `localhost:1234` |

---

## Configuration

### Environment Variables

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Ollama (optional, defaults to localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI-compatible providers
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
TOGETHER_API_KEY=...
NVIDIA_NIM_API_KEY=nvapi-...
PERPLEXITY_API_KEY=pplx-...

# Minimax
MINIMAX_API_KEY=...
MINIMAX_GROUP_ID=...
```

Copy `.env.example` to `.env.local` (web) or export variables in your shell (CLI).

### Web UI — Configure Tab

The Configure tab lets you add, remove, and tweak any number of model instances without touching config files:

- Pick a provider preset (Claude, Groq, Ollama, …) or enter a custom OpenAI-compatible URL
- Paste an API key per-instance (overrides env vars)
- Tune `temperature` and `max_tokens` per instance
- Toggle instances on/off without deleting them
- **Local CLI adapters** — enable Claude CLI or Codex CLI if the binary is on your PATH; no API key needed

---

## CLI Usage

```
Usage: llm-diff <prompt> [options]

Arguments:
  prompt                     Prompt to send to all providers

Options:
  --file <path>              Append file contents to the prompt
  --models <list>            Comma-separated providers (default: "claude,ollama")
  --runs <n>                 Number of runs for latency averaging (default: 1)
  --output <format>          pretty | json (default: "pretty")
  -V, --version              Show version
  -h, --help                 Show help
```

**Examples**

```bash
# Compare Claude vs Ollama on a coding task
llm-diff "Implement a binary search in Python" --models claude,ollama

# Benchmark: average latency over 10 runs
llm-diff "Hello" --models groq,claude --runs 10 --output json | jq '.results[].latencyMs'

# Review a file with all configured providers
llm-diff "Find bugs and suggest improvements" --file ./server.ts

# Use local CLI tools (no API key)
llm-diff "Explain recursion" --models claude-cli,codex
```

---

## Web UI

The web UI is a self-hosted Next.js app. Features:

- **Side-by-side diff** — outputs rendered in resizable panels
- **Metrics bar** — latency, token count, and estimated cost per model
- **History** — past runs saved in `localStorage`, filterable
- **Configure tab** — add/remove model instances, set credentials, tune parameters
- **JSON export** — copy the raw diff result for sharing or scripting

---

## Architecture

```
llm-diff/                  (Turborepo monorepo)
├── packages/
│   ├── core/              Provider interfaces, diff engine, cost table
│   │   ├── src/providers/ ClaudeProvider, OllamaProvider, OpenAICompatibleProvider,
│   │   │                  MinimaxProvider, SubprocessProvider
│   │   ├── src/diff.ts    runDiff() — fans out, collects results
│   │   └── src/cost.ts    Per-model pricing ($/1M tokens)
│   ├── cli/               Commander.js + Ink terminal renderer
│   └── web/               Next.js app — API route + React UI
```

**Adding a new provider** takes ~30 lines: implement the `Provider` interface from `@llm-diff/core` and register it in the web route handler. The `OpenAICompatibleProvider` covers most REST APIs; the `SubprocessProvider` covers local CLI tools.

---

## Contributing

```bash
git clone https://github.com/darkrishabh/llm-diff
cd llm-diff
npm install
npm run dev          # starts CLI watch + Next.js dev server
npm run build        # full monorepo build
npm run type-check   # TypeScript across all packages
```

PRs welcome. The most impactful contributions right now:

- New provider adapters (Gemini, Bedrock, Azure OpenAI, Mistral native)
- Web UI improvements (streaming, diff highlighting, prompt templates)
- CLI output improvements (side-by-side in terminal, markdown rendering)

---

## License

MIT
