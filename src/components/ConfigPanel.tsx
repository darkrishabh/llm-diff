"use client";

import React, { useEffect, useState } from "react";
import type { LLMInstance, AnyProvider, NativeProvider, OAIPreset } from "../types";
import { PRESET_BASE_URLS, PRESET_MODELS } from "../types";

// ─── Providers with a fixed model list (no free-text input allowed) ───────────
const FIXED_MODEL_PROVIDERS = new Set<AnyProvider>(["claude-cli", "codex"]);

function useModels(
  provider: AnyProvider,
  baseUrl?: string,
  apiKey?: string
): { models: string[]; loading: boolean; error: string | null } {
  const [models, setModels]   = useState<string[]>(() => PRESET_MODELS[provider] ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (provider === "ollama") {
      let cancelled = false;
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ provider: "ollama" });
      if (baseUrl) params.set("baseUrl", baseUrl);

      fetch(`/api/models?${params}`)
        .then((r) => r.json() as Promise<{ models?: string[]; error?: string }>)
        .then((data) => {
          if (cancelled) return;
          if (data.error) {
            setError(data.error);
            setModels(PRESET_MODELS.ollama ?? []);
          } else {
            setModels(data.models ?? []);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
            setModels(PRESET_MODELS.ollama ?? []);
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });

      return () => { cancelled = true; };
    }

    if (provider === "openai") {
      if (!apiKey?.trim()) {
        setModels(PRESET_MODELS.openai ?? []);
        setError(null);
        setLoading(false);
        return;
      }

      let cancelled = false;
      setLoading(true);
      setError(null);

      fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          apiKey: apiKey.trim(),
          baseUrl: baseUrl?.trim() || undefined,
        }),
      })
        .then((r) => r.json() as Promise<{ models?: string[]; error?: string; source?: string }>)
        .then((data) => {
          if (cancelled) return;
          if (data.error) setError(data.error);
          else setError(null);
          setModels(data.models?.length ? data.models : (PRESET_MODELS.openai ?? []));
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
            setModels(PRESET_MODELS.openai ?? []);
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });

      return () => { cancelled = true; };
    }

    setModels(PRESET_MODELS[provider] ?? []);
    setError(null);
    setLoading(false);
    return undefined;
  }, [provider, baseUrl, apiKey]);

  return { models, loading, error };
}

// ─── Preset catalogue (monochrome UI — no per-provider chroma) ────────────────

interface PresetMeta {
  label: string;
  tag: string;
  isNative?: boolean;
  needsGroupId?: boolean;
  noApiKey?: boolean;
  noBaseUrl?: boolean;
}

const PRESETS: Record<AnyProvider, PresetMeta> = {
  claude:      { label: "Claude",      tag: "Anthropic",   isNative: true, noBaseUrl: true  },
  ollama:      { label: "Ollama",      tag: "Local",       isNative: true, noApiKey: true   },
  minimax:     { label: "Minimax",     tag: "Minimax AI",  isNative: true, noBaseUrl: true, needsGroupId: true },
  "claude-cli":{ label: "Claude CLI",  tag: "Local",       isNative: true, noApiKey: true, noBaseUrl: true },
  codex:       { label: "Codex CLI",   tag: "Local",       isNative: true, noApiKey: true, noBaseUrl: true },
  openai:      { label: "OpenAI",      tag: "GPT" },
  groq:        { label: "Groq",        tag: "Fast" },
  openrouter:  { label: "OpenRouter",  tag: "Multi" },
  "nvidia-nim":{ label: "NVIDIA NIM",  tag: "NIM" },
  together:    { label: "Together",    tag: "Open models" },
  perplexity:  { label: "Perplexity",  tag: "Search" },
  custom:      { label: "Custom",      tag: "OpenAI-compat" },
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
  return !PRESETS[provider].noBaseUrl;
}
function showGroupId(provider: AnyProvider): boolean {
  return !!PRESETS[provider].needsGroupId;
}
function showMaxTokens(provider: AnyProvider): boolean {
  return provider !== "ollama";
}

// ─── Monochrome tokens (Cursor-like: neutral, quiet) ──────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-md)",
  color: "var(--text-1)",
  padding: "0.45rem 0.65rem",
  fontSize: "0.8125rem",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  transition: "border-color 0.12s ease, box-shadow 0.12s ease",
};

function Field({
  label,
  labelExtra,
  children,
}: {
  label: string;
  labelExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
        <label style={{ color: "var(--text-3)", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </label>
        {labelExtra}
      </div>
      {children}
    </div>
  );
}

function SourceBadge({ children, tone }: { children: React.ReactNode; tone: "inline" | "variable" }) {
  const isInline = tone === "inline";
  return (
    <span
      style={{
        fontSize: "0.58rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "0.12rem 0.38rem",
        borderRadius: 4,
        background: isInline ? "var(--green-subtle)" : "var(--surface-muted)",
        color: isInline ? "var(--green)" : "var(--text-2)",
        border: `1px solid ${isInline ? "rgba(4, 120, 87, 0.25)" : "var(--border)"}`,
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.65rem",
        fontWeight: 600,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: "0.45rem",
      }}
    >
      {children}
    </div>
  );
}

/** Provider initials for avatar tile (e.g. NVIDIA NIM → NV). */
function providerInitials(label: string): string {
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? "";
    const b = parts[1][0] ?? "";
    return (a + b).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

function GreenToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      title={on ? "Disable" : "Enable"}
      aria-pressed={on}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: `1px solid ${on ? "var(--green)" : "var(--border-strong)"}`,
        background: on ? "var(--green)" : "var(--surface-muted)",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        padding: 0,
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 17 : 2,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: on ? "#fff" : "var(--text-3)",
          transition: "left 0.15s ease",
          boxShadow: on ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
        }}
      />
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      title={on ? "Disable" : "Enable"}
      aria-pressed={on}
      style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        border: `1px solid ${on ? "var(--text-1)" : "var(--border-strong)"}`,
        background: on ? "var(--text-1)" : "transparent",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        padding: 0,
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 15 : 2,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: on ? "var(--surface)" : "var(--text-3)",
          transition: "left 0.15s ease",
        }}
      />
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
  const { models, loading, error } = useModels(instance.provider, instance.baseUrl, instance.apiKey);
  const [customMode, setCustomMode] = useState(false);

  const fixedList = FIXED_MODEL_PROVIDERS.has(instance.provider);
  const isPlainText = models.length === 0 || instance.provider === "custom";
  const inList = models.includes(instance.model);
  const showCustomInput = !fixedList && (customMode || (!loading && !inList && instance.model !== ""));

  useEffect(() => {
    if (!loading && models.length > 0 && !instance.model) {
      onUpdate({ model: models[0] });
    }
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
        placeholder="Model"
      />
    );
  }

  if (loading) {
    return (
      <div style={{ ...inputStyle, color: "var(--text-3)", display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: "0.75rem" }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
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
        {!fixedList && <option value={OTHER_VALUE}>Other…</option>}
      </select>

      {showCustomInput && (
        <input
          value={instance.model}
          onChange={(e) => onUpdate({ model: e.target.value })}
          style={inputStyle}
          placeholder="Model name"
          autoFocus
        />
      )}

      {error && (
        <span style={{ fontSize: "0.65rem", color: "var(--text-2)" }}>
          {error} — default list
        </span>
      )}
    </div>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {up ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
    </svg>
  );
}

function InstanceCard({
  instance,
  onUpdate,
  onRemove,
  secretNames,
  secrets,
  expanded,
  onToggleExpand,
}: {
  instance: LLMInstance;
  onUpdate: (patch: Partial<LLMInstance>) => void;
  onRemove: () => void;
  /** Secret variable names (from Settings → Secrets), for API key / group ID picker */
  secretNames: string[];
  secrets: Record<string, string>;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const meta = PRESETS[instance.provider];
  const isMinimax = instance.provider === "minimax";
  const apiRef = instance.apiKeySecretRef?.trim() ?? "";
  const groupRef = instance.groupIdSecretRef?.trim() ?? "";
  const initials = providerInitials(meta.label);

  const apiKeyField = showApiKey(instance.provider) && (
    <Field
      label={isMinimax ? "Minimax API key" : "API key"}
      labelExtra={apiRef ? <SourceBadge tone="variable">Variable</SourceBadge> : <SourceBadge tone="inline">inline</SourceBadge>}
    >
      <select
        value={apiRef}
        onChange={(e) =>
          onUpdate({
            apiKeySecretRef: e.target.value ? e.target.value : undefined,
          })
        }
        style={{ ...inputStyle, cursor: "pointer", width: "100%", marginBottom: apiRef ? "0.35rem" : 0 }}
        aria-label="API key source"
      >
        <option value="">Inline (paste below)</option>
        {secretNames.map((k) => (
          <option key={k} value={k}>
            Variable: {k}
          </option>
        ))}
      </select>
      {apiRef ? (
        <p
          style={{
            margin: 0,
            fontSize: "0.65rem",
            color: secrets[apiRef]?.trim() ? "var(--text-2)" : "var(--amber)",
          }}
        >
          {secrets[apiRef]?.trim()
            ? `Using saved secret “${apiRef}”.`
            : `Secret “${apiRef}” is empty — add it under Settings → Secrets, or use inline key below.`}
        </p>
      ) : null}
      <input
        type="password"
        value={instance.apiKey ?? ""}
        onChange={(e) => onUpdate({ apiKey: e.target.value })}
        style={{ ...inputStyle, opacity: apiRef && !instance.apiKey?.trim() ? 0.85 : 1 }}
        placeholder={
          apiRef
            ? "Optional override if variable is empty"
            : isMinimax
              ? "Paste key or set MINIMAX_API_KEY in env"
              : "Env or paste key"
        }
        autoComplete="off"
      />
    </Field>
  );

  const groupIdField = showGroupId(instance.provider) && (
    <Field
      label="Minimax Group ID"
      labelExtra={groupRef ? <SourceBadge tone="variable">Variable</SourceBadge> : <SourceBadge tone="inline">inline</SourceBadge>}
    >
      <select
        value={groupRef}
        onChange={(e) =>
          onUpdate({
            groupIdSecretRef: e.target.value ? e.target.value : undefined,
          })
        }
        style={{ ...inputStyle, cursor: "pointer", width: "100%", marginBottom: groupRef ? "0.35rem" : 0 }}
        aria-label="Group ID source"
      >
        <option value="">Inline (paste below)</option>
        {secretNames.map((k) => (
          <option key={k} value={k}>
            Variable: {k}
          </option>
        ))}
      </select>
      {groupRef ? (
        <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-2)" }}>
          {secrets[groupRef]?.trim()
            ? `Using saved secret “${groupRef}”.`
            : `Secret “${groupRef}” is empty — add it under Settings → Secrets.`}
        </p>
      ) : null}
      <input
        value={instance.groupId ?? ""}
        onChange={(e) => onUpdate({ groupId: e.target.value })}
        style={inputStyle}
        placeholder="Paste GroupId or set MINIMAX_GROUP_ID in env"
        autoComplete="off"
      />
    </Field>
  );

  const modelField = (
    <Field label="Model">
      <ModelField instance={instance} onUpdate={onUpdate} />
    </Field>
  );

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        boxShadow: "var(--shadow-xs)",
        opacity: instance.enabled ? 1 : 0.72,
        transition: "opacity 0.12s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          padding: "0.75rem 0.85rem",
          minHeight: 52,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--r-md)",
            background: "var(--surface-muted)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.72rem",
            fontWeight: 800,
            color: "var(--text-2)",
            letterSpacing: "-0.02em",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {meta.label}
          </div>
          <div
            style={{
              fontSize: "0.84rem",
              fontWeight: 700,
              color: "var(--text-1)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-mono)",
            }}
            title={instance.model || undefined}
          >
            {instance.model || "No model"}
          </div>
        </div>
        <GreenToggle on={instance.enabled} onChange={() => onUpdate({ enabled: !instance.enabled })} />
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
          style={{
            background: "var(--surface-muted)",
            border: "1px solid var(--border)",
            color: "var(--text-2)",
            cursor: "pointer",
            width: 34,
            height: 34,
            borderRadius: "var(--r-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          <ChevronIcon up={expanded} />
        </button>
      </div>

      {expanded ? (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "0.85rem 0.85rem 0.95rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem",
            background: "var(--surface-subtle)",
          }}
        >
          {isMinimax && (
            <p
              style={{
                margin: 0,
                fontSize: "0.6875rem",
                lineHeight: 1.45,
                color: "var(--text-2)",
              }}
            >
              Minimax needs an API key and a Group ID. Enter them here, or define{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>MINIMAX_API_KEY</span> and{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>MINIMAX_GROUP_ID</span> for the
              server.
            </p>
          )}

          {isMinimax ? (
            <>
              {apiKeyField}
              {groupIdField}
              {modelField}
            </>
          ) : (
            <>
              {modelField}
              {apiKeyField}
            </>
          )}

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
                      ? "https://…/v1"
                      : PRESET_BASE_URLS[instance.provider as OAIPreset] ?? ""
                }
              />
            </Field>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: showMaxTokens(instance.provider) ? "1fr 1fr" : "1fr",
              gap: "0.55rem",
            }}
          >
            {showMaxTokens(instance.provider) && (
              <Field label="Max tokens">
                <input
                  type="number"
                  value={instance.maxTokens ?? 2048}
                  onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value, 10) || 2048 })}
                  style={{ ...inputStyle, width: "100%" }}
                  min={1}
                  max={128000}
                  step={256}
                />
              </Field>
            )}
            <Field label={`Temperature · ${(instance.temperature ?? 0.7).toFixed(2)}`}>
              <input
                type="range"
                value={instance.temperature ?? 0.7}
                onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
                min={0}
                max={1}
                step={0.05}
                style={{
                  width: "100%",
                  accentColor: "var(--text-1)",
                  cursor: "pointer",
                }}
              />
            </Field>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Models tab (embedded in Settings panel) ──────────────────────────────────

export interface ModelsSettingsSectionProps {
  instances: LLMInstance[];
  onUpdate: (instances: LLMInstance[]) => void;
  /** Keys defined under Settings → Secrets */
  secretNames: string[];
  secrets: Record<string, string>;
}

const ADD_PLACEHOLDER = "";

export function ModelsSettingsSection({
  instances,
  onUpdate,
  secretNames,
  secrets,
}: ModelsSettingsSectionProps) {
  const [addProviderValue, setAddProviderValue] = useState(ADD_PLACEHOLDER);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const patch = (id: string, p: Partial<LLMInstance>) =>
    onUpdate(instances.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id: string) => onUpdate(instances.filter((i) => i.id !== id));
  const add = (provider: AnyProvider) => onUpdate([...instances, makeInstance(provider)]);

  const active = instances.filter((i) => i.enabled).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "0 0 0.5rem" }}>
        <p style={{ margin: "0 0 0.35rem", fontSize: "0.6875rem", color: "var(--text-3)" }}>
          {active} active · {instances.length} total
        </p>
        <Field label="Add provider">
          <select
            value={addProviderValue}
            onChange={(e) => {
              const v = e.target.value as AnyProvider;
              if (!v) return;
              add(v);
              setAddProviderValue(ADD_PLACEHOLDER);
            }}
            style={{ ...inputStyle, cursor: "pointer", width: "100%" }}
            aria-label="Add provider"
          >
            <option value={ADD_PLACEHOLDER}>Choose a provider…</option>
            {PRESET_ORDER.map((p) => {
              const m = PRESETS[p];
              return (
                <option key={p} value={p}>
                  {m.label} — {m.tag}
                </option>
              );
            })}
          </select>
        </Field>
      </div>

      <div style={{ height: 1, background: "var(--border)", margin: "0.35rem 0 0.65rem" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1, overflowY: "auto", paddingBottom: "0.5rem" }}>
        {instances.length === 0 ? (
          <p style={{ textAlign: "center", padding: "2rem 0.5rem", color: "var(--text-3)", fontSize: "0.8125rem", margin: 0 }}>
            No models. Choose a provider from the dropdown above.
          </p>
        ) : (
          instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              onUpdate={(p) => patch(instance.id, p)}
              onRemove={() => remove(instance.id)}
              secretNames={secretNames}
              secrets={secrets}
              expanded={expandedCardId === instance.id}
              onToggleExpand={() =>
                setExpandedCardId((cur) => (cur === instance.id ? null : instance.id))
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
