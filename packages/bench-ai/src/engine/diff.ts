import type { Provider } from "./providers/base.js";
import type { DiffResult, ProviderName, ProviderConfig, RunOptions } from "./types.js";
import { ClaudeProvider } from "./providers/claude.js";
import { OllamaProvider } from "./providers/ollama.js";
import { MinimaxProvider } from "./providers/minimax.js";

function buildProviders(
  providers: ProviderName[],
  config: ProviderConfig
): Provider[] {
  return providers.flatMap((name): Provider[] => {
    switch (name) {
      case "claude":
        if (!config.claude?.apiKey) return [];
        return [new ClaudeProvider(config.claude.apiKey, config.claude.model)];
      case "ollama":
        return [
          new OllamaProvider(config.ollama?.baseUrl, config.ollama?.model),
        ];
      case "minimax":
        if (!config.minimax?.apiKey || !config.minimax?.groupId) return [];
        return [
          new MinimaxProvider(
            config.minimax.apiKey,
            config.minimax.groupId,
            config.minimax.model
          ),
        ];
      default:
        return [];
    }
  });
}

export async function runDiff(options: RunOptions): Promise<DiffResult> {
  const { prompt, providers, config } = options;
  const instances = buildProviders(providers, config);

  const results = await Promise.all(instances.map((p) => p.complete(prompt)));

  return {
    prompt,
    results,
    ranAt: new Date().toISOString(),
  };
}

export async function runDiffMany(
  options: RunOptions & { runs: number }
): Promise<DiffResult[]> {
  const runs: DiffResult[] = [];
  for (let i = 0; i < options.runs; i++) {
    runs.push(await runDiff(options));
  }
  return runs;
}
