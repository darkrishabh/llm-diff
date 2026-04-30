import type { ProviderResult } from "../types.js";
import type { AttachedFile } from "../../skills/types.js";

export interface ProviderCapabilities {
  attachments?: boolean;
  systemRole?: boolean;
}

export interface CompleteChatArgs {
  system?: string;
  user: string;
  model?: string;
  attachments?: AttachedFile[];
}

export interface Provider {
  readonly name: string;
  readonly model: string;
  readonly capabilities?: ProviderCapabilities;
  complete(prompt: string): Promise<ProviderResult>;
  completeChat?(args: CompleteChatArgs): Promise<ProviderResult>;
}
