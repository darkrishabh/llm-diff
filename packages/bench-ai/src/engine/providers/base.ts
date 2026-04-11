import type { ProviderResult } from "../types.js";

export interface Provider {
  readonly name: string;
  readonly model: string;
  complete(prompt: string): Promise<ProviderResult>;
}
