"use client";

import React, { useEffect, useState } from "react";
import type { LLMInstance, AnyProvider, NativeProvider, OAIPreset } from "../types";
import { PRESET_BASE_URLS, PRESET_MODELS } from "../types";

// ─── Providers that support live model discovery ──────────────────────────────
const DYNAMIC_PROVIDERS = new Set<AnyProvider>(["ollama"]);

function useModels(provider: AnyProvider, baseUrl?: string): { models: string[]; loading: boolean; error: string | null } {
  const [models, setModels]   = useState<string[]>(() => PRESET_MODELS[provider] ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!DYNAMIC_PROVIDERS.has(provider)) {
      setModels(PRESET_MODELS[provider] ?? []);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ provider });
    if (baseUrl) params.set("baseUrl", baseUrl);

    fetch(`/api/models?${params}`)
      .then((r) => r.json() as Promise<{ models?: string[]; error?: string }>)
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setModels(PRESET_MODELS[provider] ?? []);
        } else {
          setModels(data.models ?? []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setModels(PRESET_MODELS[provider] ?? []);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [provider, baseUrl]);

  return { models, loading, error };
}

// ─── Preset catalogue ─────────────────────────────────────────────────────────

interface PresetMeta {
  label: string;
  tag: string;           // short descriptor shown under the name
  color: string;
  isNative?: boolean;    // uses a dedicated provider class (not openai-compat)
  needsGroupId?: boolean;
  noApiKey?: boolean;
  noBaseUrl?: boolean;
}

const PRESETS: Record<AnyProvider, PresetMeta> = {
  // Native API providers
  claude:      { label: "Claude",      tag: "Anthropic",   color: "#6d28d9", isNative: true, noBaseUrl: true  },
  ollama:      { label: "Ollama",      tag: "Local",       color: "#065f46", isNative: true, noApiKey: true   },
  minimax:     { label: "Minimax",     tag: "Minimax AI",  color: "#c2410c", isNative: true, noBaseUrl: true, needsGroupId: true },
  // Local CLI adapters (no API key needed, binary must be on PATH)
  "claude-cli":{ label: "Claude CLI",  tag: "Local binary",color: "#6d28d9", isNative: true, noApiKey: true, noBaseUrl: true },
  codex:       { label: "Codex CLI",   tag: "Local binary",color: "#10a37f", isNative: true, noApiKey: true, noBaseUrl: true },
  // OpenAI-compatible providers
  openai:      { label: "OpenAI",      tag: "GPT / o-series", color: "#10a37f" },
  groq:        { label: "Groq",        tag: "Fast inference",  color: "#f55036" },
  openrouter:  { label: "OpenRouter",  tag: "Multi-provider",  color: "#6c47ff" },
  "nvidia-nim":{ label: "NVIDIA NIM",  tag: "NIM endpoints",   color: "#76b900" },
  together:    { label: "Together AI", tag: "Open models",     color: "#2563eb" },
  perplexity:  { label: "Perplexity",  tag: "Search-augmented",color: "#20808d" },
  custom:      { label: "Custom",      tag: "OpenAI-compat",   color: "#6b7280" },
};

const PRESET_ORDER: AnyProvider[] = [
  "claude", "claude-cli", "codex",
  "openai", "ollama",
  "groq", "openrouter", "nvidia-nim",
  "together", "perplexity", "minimax",
  "custom",
];

// ─── Factory ──────────────────────────────────────────────────────────────────

function makeInstance(provider: AnyProvider): LLMInstance {
  const suggestions = PRESET_MODELS[provider];
  const baseUrl = !PRESETS[provider].isNative || provider === "ollama"
    ? (PRESET_BASE_URLS[provider as OAIPreset] ?? "")
    : undefined;

  return {
    id: `${provider}-${Date.now()}`,
    provider,
    model: suggestions[0] ?? "",
    enabled: true,
    baseUrl: baseUrl || (provider === "ollama" ? "http://localhost:11434" : undefined),
    maxTokens: provider !== "ollama" ? 2048 : undefined,
    temperature: 0.7,
  };
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function showApiKey(provider: AnyProvider): boolean {
  return !PRESETS[provider].noApiKey;
}
function showBaseUrl(provider: AnyProvider): boolean {
  // ollama (native) → yes. All OAI-compat → yes. Claude/Minimax → no.
  return !PRESETS[provider].noBaseUrl;
}
function showGroupId(provider: AnyProvider): boolean {
  return !!PRESETS[provider].needsGroupId;
}
function showMaxTokens(provider: AnyProvider): boolean {
  return provider !== "ollama";
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-sm)",
  color: "var(--text-1)",
  padding: "0.45rem 0.65rem",
  fontSize: "0.82rem",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <label style={{ color: "var(--text-3)", fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ on, color, onChange }: { on: boolean; color: string; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      title={on ? "Disable" : "Enable"}
      style={{
        width: 36, height: 20, borderRadius: 10,
        border: `1px solid ${on ? color : "var(--border-strong)"}`,
        background: on ? color : "var(--surface-hover)",
        cursor: "pointer", position: "relative",
        transition: "background 0.2s, border-color 0.2s",
        flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: "50%",
        background: on ? "#fff" : "var(--text-3)",
        transition: "left 0.15s",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }} />
    </button>
  );
}

// ─── Instance card ────────────────────────────────────────────────────────────

const OTHER_VALUE = "__other__";

function ModelField({
  instance, onUpdate,
}: {
  instance: LLMInstance;
  onUpdate: (patch: Partial<LLMInstance>) => void;
}) {
  const { models, loading, error } = useModels(instance.provider, instance.baseUrl);
  // "Other" mode: user explicitly chose to type a custom value
  const [customMode, setCustomMode] = useState(false);

  const isPlainText = models.length === 0 || instance.provider === "custom";
  // Once models load, check if the current model is in the list
  const inList = models.includes(instance.model);
  // Show custom text input when: user clicked "Other…", OR models loaded and the
  // saved model isn't in the list (e.g. a model they typed before)
  const showCustomInput = customMode || (!loading && !inList && instance.model !== "");

  useEffect(() => {
    // Auto-select first model when list loads and nothing is set yet
    if (!loading && models.length > 0 && !instance.model) {
      onUpdate({ model: models[0] });
    }
    // If the loaded list now contains the current model, exit custom mode
    if (!loading && inList) {
      setCustomMode(false);
    }
  }, [loading, models, inList]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPlainText) {
    return (
      <input
        value={instance.model}
        onChange={(e) => onUpdate({ model: e.target.value })}
        style={inputStyle}
        placeholder="model name"
      />
    );
  }

  if (loading) {
    return (
      <div style={{ ...inputStyle, color: "var(--text-3)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span style={{ fontSize: "0.75rem" }}>Loading models…</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <select
        value={showCustomInput ? OTHER_VALUE : instance.model}
        onChange={(e) => {
          if (e.target.value === OTHER_VALUE) {
            setCustomMode(true);
          } else {
            setCustomMode(false);
            onUpdate({ model: e.target.value });
          }
        }}
        style={{ ...inputStyle, cursor: "pointer" }}
      >
        {models.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
        <option value={OTHER_VALUE}>Other…</option>
      </select>

      {showCustomInput && (
        <input
          value={instance.model}
          onChange={(e) => onUpdate({ model: e.target.value })}
          style={inputStyle}
          placeholder="Enter model name"
          autoFocus
        />
      )}

      {error && (
        <span style={{ fontSize: "0.7rem", color: "var(--yellow)", marginTop: "0.1rem" }}>
          ⚠ {error} — using default list
        </span>
      )}
    </div>
  );
}

function InstanceCard({
  instance, onUpdate, onRemove,
}: {
  instance: LLMInstance;
  onUpdate: (patch: Partial<LLMInstance>) => void;
  onRemove: () => void;
}) {
  const meta = PRESETS[instance.provider];

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${instance.enabled ? meta.color + "33" : "var(--border)"}`,
      borderLeft: `3px solid ${instance.enabled ? meta.color : "var(--border-strong)"}`,
      borderRadius: "var(--r-md)",
      padding: "0.875rem",
      display: "flex", flexDirection: "column", gap: "0.75rem",
      opacity: instance.enabled ? 1 : 0.6,
      transition: "opacity 0.15s, border-color 0.15s",
      boxShadow: "var(--shadow-xs)",
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{
          padding: "0.1rem 0.5rem", borderRadius: 4,
          background: meta.color + "18", color: meta.color,
          border: `1px solid ${meta.color}30`,
          fontSize: "0.68rem", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {meta.label}
        </span>
        <span style={{ flex: 1, fontSize: "0.78rem", color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {instance.model || <span style={{ color: "var(--text-3)" }}>no model set</span>}
        </span>
        <Toggle on={instance.enabled} color={meta.color} onChange={() => onUpdate({ enabled: !instance.enabled })} />
        <button
          onClick={onRemove}
          style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: "0.8rem", padding: "0.15rem 0.35rem", borderRadius: 4, lineHeight: 1, fontFamily: "inherit", transition: "color 0.1s, background 0.1s" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-subtle)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "none"; }}
        >✕</button>
      </div>

      {/* Model */}
      <Field label="Model">
        <ModelField instance={instance} onUpdate={onUpdate} />
      </Field>

      {/* API Key */}
      {showApiKey(instance.provider) && (
        <Field label="API Key">
          <input
            type="password"
            value={instance.apiKey ?? ""}
            onChange={(e) => onUpdate({ apiKey: e.target.value })}
            style={inputStyle}
            placeholder={`sk-… (or set via env var)`}
          />
        </Field>
      )}

      {/* Group ID (Minimax) */}
      {showGroupId(instance.provider) && (
        <Field label="Group ID">
          <input
            value={instance.groupId ?? ""}
            onChange={(e) => onUpdate({ groupId: e.target.value })}
            style={inputStyle}
            placeholder="Minimax Group ID"
          />
        </Field>
      )}

      {/* Base URL */}
      {showBaseUrl(instance.provider) && (
        <Field label="Base URL">
          <input
            value={instance.baseUrl ?? ""}
            onChange={(e) => onUpdate({ baseUrl: e.target.value })}
            style={inputStyle}
            placeholder={
              instance.provider === "ollama"
                ? "http://localhost:11434"
                : instance.provider === "custom"
                ? "https://your-endpoint.com/v1"
                : PRESET_BASE_URLS[instance.provider as OAIPreset] ?? ""
            }
          />
        </Field>
      )}

      {/* Max Tokens */}
      {showMaxTokens(instance.provider) && (
        <Field label="Max Tokens">
          <input
            type="number"
            value={instance.maxTokens ?? 2048}
            onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) || 2048 })}
            style={{ ...inputStyle, width: 120 }}
            min={1} max={128000} step={256}
          />
        </Field>
      )}

      {/* Temperature */}
      <Field label={`Temperature — ${(instance.temperature ?? 0.7).toFixed(2)}`}>
        <input
          type="range"
          value={instance.temperature ?? 0.7}
          onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
          min={0} max={1} step={0.05}
          style={{ width: "100%", accentColor: meta.color, cursor: "pointer" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-3)", fontSize: "0.68rem", marginTop: "-0.15rem" }}>
          <span>Precise</span><span>Creative</span>
        </div>
      </Field>
    </div>
  );
}

// ─── Preset picker ────────────────────────────────────────────────────────────

function PresetCard({ provider, onClick }: { provider: AnyProvider; onClick: () => void }) {
  const meta = PRESETS[provider];
  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: `1px solid var(--border)`,
        borderRadius: "var(--r-sm)",
        padding: "0.6rem 0.7rem",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "all 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: "0.15rem",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = meta.color + "60";
        e.currentTarget.style.background = meta.color + "0a";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.background = "var(--surface)";
      }}
    >
      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: meta.color }}>{meta.label}</span>
      <span style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>{meta.tag}</span>
    </button>
  );
}

// ─── ConfigPanel ──────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  instances: LLMInstance[];
  onUpdate: (instances: LLMInstance[]) => void;
  onClose: () => void;
}

export function ConfigPanel({ instances, onUpdate, onClose }: ConfigPanelProps) {
  const patch = (id: string, p: Partial<LLMInstance>) =>
    onUpdate(instances.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id: string) => onUpdate(instances.filter((i) => i.id !== id));
  const add    = (provider: AnyProvider) => onUpdate([...instances, makeInstance(provider)]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.3)", zIndex: 40, backdropFilter: "blur(2px)" }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 440,
        background: "var(--bg)",
        borderLeft: "1px solid var(--border)",
        zIndex: 50, overflowY: "auto",
        boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{
          position: "sticky", top: 0, background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "1rem 1.25rem",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          zIndex: 1,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-1)" }}>Configure Models</div>
            <div style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: "0.1rem" }}>
              {instances.filter((i) => i.enabled).length} of {instances.length} active
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: "var(--r-sm)", width: 28, height: 28, cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}
          >✕</button>
        </div>

        {/* Preset grid */}
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{ color: "var(--text-3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, marginBottom: "0.65rem" }}>
            Add Provider
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
            {PRESET_ORDER.map((p) => (
              <PresetCard key={p} provider={p} onClick={() => add(p)} />
            ))}
          </div>
        </div>

        {/* Instance list */}
        <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
          {instances.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-3)", fontSize: "0.875rem" }}>
              No models yet. Add one above.
            </div>
          ) : (
            instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                onUpdate={(p) => patch(instance.id, p)}
                onRemove={() => remove(instance.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
