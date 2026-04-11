/** Shared provider colors for chips, cards, and run-target UI */

export const PROVIDER_UI: Record<string, { color: string; border: string }> = {
  claude:      { color: "var(--claude)",      border: "var(--claude-border)"      },
  ollama:      { color: "var(--ollama)",      border: "var(--ollama-border)"      },
  minimax:     { color: "var(--minimax)",     border: "var(--minimax-border)"     },
  openai:      { color: "var(--openai)",      border: "var(--openai-border)"      },
  groq:        { color: "var(--groq)",        border: "var(--groq-border)"        },
  openrouter:  { color: "var(--openrouter)",  border: "var(--openrouter-border)"  },
  "nvidia-nim":{ color: "var(--nvidia-nim)",  border: "var(--nvidia-nim-border)"  },
  together:    { color: "var(--together)",    border: "var(--together-border)"    },
  perplexity:  { color: "var(--perplexity)",  border: "var(--perplexity-border)"  },
  custom:      { color: "var(--custom)",      border: "var(--custom-border)"      },
  "claude-cli":{ color: "var(--claude)",      border: "var(--claude-border)"      },
  codex:       { color: "var(--openai)",      border: "var(--openai-border)"      },
};

/** Header-style label, e.g. `nvidia-nim` → `NVIDIA-NIM`. */
export function formatProviderDisplayName(provider: string): string {
  return provider.replace(/_/g, "-").toUpperCase();
}

export function providerUi(provider: string) {
  return (
    PROVIDER_UI[provider] ?? {
      color: "var(--text-3)",
      border: "var(--border)",
    }
  );
}
