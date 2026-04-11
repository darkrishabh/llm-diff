// Prices per 1M tokens in USD  (last updated 2025-04)
const PRICING: Record<string, { input: number; output: number }> = {
  // ── Anthropic Claude ─────────────────────────────────────────────────────
  "claude-3-5-haiku-20241022":  { input: 0.80,  output: 4.00  },
  "claude-3-5-sonnet-20241022": { input: 3.00,  output: 15.00 },
  "claude-opus-4-5":            { input: 15.00, output: 75.00 },

  // ── OpenAI ───────────────────────────────────────────────────────────────
  "gpt-4o":                     { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":                { input: 0.15,  output: 0.60  },
  "gpt-4-turbo":                { input: 10.00, output: 30.00 },
  "gpt-4":                      { input: 30.00, output: 60.00 },
  "gpt-3.5-turbo":              { input: 0.50,  output: 1.50  },
  "o1":                         { input: 15.00, output: 60.00 },
  "o1-mini":                    { input: 3.00,  output: 12.00 },
  "o3-mini":                    { input: 1.10,  output: 4.40  },

  // ── Groq ─────────────────────────────────────────────────────────────────
  "llama-3.3-70b-versatile":    { input: 0.59,  output: 0.79  },
  "llama-3.1-70b-versatile":    { input: 0.59,  output: 0.79  },
  "llama-3.1-8b-instant":       { input: 0.05,  output: 0.08  },
  "mixtral-8x7b-32768":         { input: 0.24,  output: 0.24  },
  "gemma2-9b-it":               { input: 0.20,  output: 0.20  },

  // ── Together AI ──────────────────────────────────────────────────────────
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo":  { input: 0.88, output: 0.88 },
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo":   { input: 0.18, output: 0.18 },
  "mistralai/Mixtral-8x22B-Instruct-v0.1":          { input: 1.20, output: 1.20 },
  "google/gemma-2-27b-it":                          { input: 0.80, output: 0.80 },

  // ── NVIDIA NIM ───────────────────────────────────────────────────────────
  "meta/llama-3.1-405b-instruct":                   { input: 3.99, output: 3.99 },
  "nvidia/llama-3.1-nemotron-70b-instruct":         { input: 0.35, output: 0.40 },
  "meta/llama-3.1-70b-instruct":                    { input: 0.35, output: 0.40 },

  // ── Perplexity ───────────────────────────────────────────────────────────
  "llama-3.1-sonar-large-128k-online":  { input: 1.00, output: 1.00 },
  "llama-3.1-sonar-small-128k-online":  { input: 0.20, output: 0.20 },

  // ── Minimax ──────────────────────────────────────────────────────────────
  "abab6.5s-chat":  { input: 0.10, output: 0.10 },
  "abab6.5-chat":   { input: 0.45, output: 0.45 },
};

export function calcCost(
  _provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const price = PRICING[model];
  if (!price) return 0;
  return (
    (inputTokens  / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  );
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.0001) return `$${usd.toExponential(2)}`;
  return `$${usd.toFixed(4)}`;
}
