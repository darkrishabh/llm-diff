import type { ProviderResult, ToolChoice, ToolDef } from "../types.js";
import type { AttachedFile } from "../../skills/types.js";

export interface ProviderCapabilities {
  attachments?: boolean;
  systemRole?: boolean;
  /** Provider can pass `tools` / `tool_choice` and return structured `tool_calls`. */
  toolCalls?: boolean;
}

export interface CompleteChatArgs {
  system?: string;
  user: string;
  model?: string;
  attachments?: AttachedFile[];
  /** Function tools the model is allowed to call. */
  tools?: ToolDef[];
  /** Tool selection control. Defaults to `"auto"` when `tools` is non-empty. */
  toolChoice?: ToolChoice;
  /**
   * Freeform inference parameters merged into the upstream request body
   * (e.g. `temperature`, `max_tokens`, `top_p`, `response_format`). Treated
   * as a passthrough — the SDK does not opine on these values.
   */
  params?: Record<string, unknown>;
}

export interface Provider {
  readonly name: string;
  readonly model: string;
  readonly capabilities?: ProviderCapabilities;
  complete(prompt: string): Promise<ProviderResult>;
  completeChat?(args: CompleteChatArgs): Promise<ProviderResult>;
}
