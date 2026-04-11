/**
 * Filter OpenAI `GET /v1/models` IDs for chat-style use in our UI.
 *
 * Note: OpenAI does not always expose every chat-capable model in this list (tier,
 * product, or API surface). If a model is missing here, use **Other…** in Settings
 * and paste the exact model id from the OpenAI docs.
 */

const DROP = (id: string) => {
  const l = id.toLowerCase();
  if (l.includes("embedding")) return true;
  if (l.includes("whisper")) return true;
  if (l.includes("tts")) return true;
  if (l.includes("dall-e") || l.includes("dalle")) return true;
  if (l.includes("moderation")) return true;
  if (l.includes("realtime")) return true;
  if (l.includes("transcribe")) return true;
  if (l.includes("speech")) return true;
  /** Audio / non-text completion SKUs */
  if (/\baudio\b/.test(l)) return true;
  if (l.includes("computer-use")) return true;
  if (l.startsWith("ft:")) return true;
  /**
   * Drop search-augmented / search API SKUs only — not bare substring "search"
   * (that can appear inside unrelated id segments and hide GPT-5+ ids).
   */
  if (l.includes("search-preview") || l.includes("search-api") || /gpt-4o-search/.test(l)) return true;
  return false;
};

export function filterOpenAiChatModelIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => id && !DROP(id)))].sort((a, b) => a.localeCompare(b));
}
