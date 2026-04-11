"use client";

import React, { useId, useMemo, useState } from "react";
import type { JudgeSettings, LLMInstance, SecretsMap } from "../types";
import { DEFAULT_JUDGE_SETTINGS, SUGGESTED_SECRET_KEYS } from "../types";
import { ModelsSettingsSection } from "./ConfigPanel";
import { exportAppConfigYaml, mergeImportedConfig, parseAppConfigYaml } from "../lib/config-yaml";

type SettingsTab = "models" | "secrets" | "judge" | "config";

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
};

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  instances: LLMInstance[];
  onUpdateInstances: (instances: LLMInstance[]) => void;
  secrets: SecretsMap;
  onUpdateSecrets: (secrets: SecretsMap) => void;
  judge: JudgeSettings;
  onUpdateJudge: (j: JudgeSettings) => void;
}

export function SettingsPanel({
  open,
  onClose,
  instances,
  onUpdateInstances,
  secrets,
  onUpdateSecrets,
  judge,
  onUpdateJudge,
}: SettingsPanelProps) {
  const anthropicDatalistId = useId();
  const [tab, setTab] = useState<SettingsTab>("models");
  const [yamlDraft, setYamlDraft] = useState("");
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  const secretNames = useMemo(
    () => Object.keys(secrets).sort((a, b) => a.localeCompare(b)),
    [secrets]
  );

  const secretRows = useMemo(
    () => secretNames.map((k) => ({ key: k, value: secrets[k] ?? "" })),
    [secretNames, secrets]
  );

  const setSecretKey = (oldKey: string, newKey: string) => {
    const k = newKey.trim();
    if (!k || k === oldKey) return;
    if (secrets[k] !== undefined && k !== oldKey) return;
    const next = { ...secrets };
    const v = next[oldKey] ?? "";
    delete next[oldKey];
    next[k] = v;
    onUpdateSecrets(next);
  };

  const setSecretValue = (key: string, value: string) => {
    onUpdateSecrets({ ...secrets, [key]: value });
  };

  const removeSecret = (key: string) => {
    const next = { ...secrets };
    delete next[key];
    onUpdateSecrets(next);
  };

  const addEmptySecret = () => {
    let n = 1;
    let id = "api_key";
    while (secrets[id] !== undefined) {
      id = `api_key_${n++}`;
    }
    onUpdateSecrets({ ...secrets, [id]: "" });
  };

  const addSuggested = (key: string) => {
    if (secrets[key] !== undefined) return;
    onUpdateSecrets({ ...secrets, [key]: "" });
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        role="presentation"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.35)",
          zIndex: 40,
          backdropFilter: "blur(8px)",
        }}
      />

      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(620px, 100vw)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-drawer)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            flexShrink: 0,
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "1rem 1.15rem",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "var(--text-1)",
                letterSpacing: "-0.03em",
                margin: 0,
              }}
            >
              Settings
            </h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "var(--text-3)", fontWeight: 500, lineHeight: 1.45 }}>
              Models, secrets, judge, and config backup
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "var(--surface-muted)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              borderRadius: "var(--r-md)",
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: "1.15rem",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            ×
          </button>
        </header>

        <nav
          style={{
            flexShrink: 0,
            display: "flex",
            gap: "0.15rem",
            padding: "0 1.15rem",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            overflowX: "auto",
          }}
          aria-label="Settings sections"
        >
          {(
            [
              ["models", "Models"],
              ["secrets", "Secrets"],
              ["judge", "Judge"],
              ["config", "YAML"],
            ] as const
          ).map(([id, label]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  setConfigMsg(null);
                }}
                style={{
                  padding: "0.65rem 0.15rem",
                  marginRight: "1.1rem",
                  marginBottom: -1,
                  border: "none",
                  borderBottom: on ? "2px solid var(--text-1)" : "2px solid transparent",
                  background: "transparent",
                  color: on ? "var(--text-1)" : "var(--text-3)",
                  fontSize: "0.8125rem",
                  fontWeight: on ? 600 : 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.15rem 1.25rem", minHeight: 0, background: "var(--surface-subtle)" }}>
          {tab === "models" && (
            <ModelsSettingsSection
              instances={instances}
              onUpdate={onUpdateInstances}
              secretNames={secretNames}
              secrets={secrets}
            />
          )}

          {tab === "secrets" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-2)", lineHeight: 1.5 }}>
                Name each key (e.g. <code style={{ fontSize: "0.7rem" }}>anthropic</code>) and paste the
                value. In <strong>Models</strong>, pick <em>Variable: …</em> to use a saved secret instead of
                an inline key. Values stay in this browser (localStorage).
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {SUGGESTED_SECRET_KEYS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => addSuggested(key)}
                    disabled={secrets[key] !== undefined}
                    style={{
                      fontSize: "0.68rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: secrets[key] !== undefined ? "var(--surface-hover)" : "var(--surface)",
                      color: secrets[key] !== undefined ? "var(--text-3)" : "var(--text-2)",
                      cursor: secrets[key] !== undefined ? "default" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    + {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={addEmptySecret}
                style={{
                  alignSelf: "flex-start",
                  fontSize: "0.75rem",
                  padding: "0.35rem 0.65rem",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "var(--text-1)",
                }}
              >
                + Custom variable
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {secretRows.length === 0 ? (
                  <p style={{ color: "var(--text-3)", fontSize: "0.8125rem", margin: 0 }}>
                    No secrets yet. Add a suggested key or a custom variable.
                  </p>
                ) : (
                  secretRows.map(({ key, value }) => (
                    <div
                      key={key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(100px, 1fr) 2fr auto",
                        gap: "0.4rem",
                        alignItems: "center",
                      }}
                    >
                      <input
                        value={key}
                        onChange={(e) => setSecretKey(key, e.target.value)}
                        style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}
                        placeholder="variable_name"
                        spellCheck={false}
                      />
                      <input
                        type="password"
                        value={value}
                        onChange={(e) => setSecretValue(key, e.target.value)}
                        style={inputStyle}
                        placeholder="Secret value"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => removeSecret(key)}
                        aria-label={`Remove ${key}`}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--text-3)",
                          cursor: "pointer",
                          fontSize: "1rem",
                          padding: "0.2rem",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "judge" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", maxWidth: 420 }}>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-2)", lineHeight: 1.5 }}>
                Used for <strong>llm-rubric</strong> assertions in Test Suites. Choose how responses are
                scored when the suite YAML includes <code style={{ fontSize: "0.7rem" }}>type: llm-rubric</code>
                .
              </p>
              <label style={{ fontSize: "0.6875rem", color: "var(--text-3)", fontWeight: 500 }}>Mode</label>
              <select
                value={judge.mode}
                onChange={(e) =>
                  onUpdateJudge({
                    ...judge,
                    mode: e.target.value as JudgeSettings["mode"],
                  })
                }
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="auto">Auto — Claude if Anthropic secret / env is available</option>
                <option value="claude">Claude (Anthropic API)</option>
                <option value="ollama">Ollama (local)</option>
                <option value="none">None — llm-rubric will fail without a judge</option>
              </select>

              {(judge.mode === "auto" || judge.mode === "claude") && (
                <>
                  <label style={{ fontSize: "0.6875rem", color: "var(--text-3)", fontWeight: 500 }}>
                    Anthropic API key — Secrets variable name
                  </label>
                  <input
                    value={judge.anthropicSecretRef}
                    onChange={(e) => onUpdateJudge({ ...judge, anthropicSecretRef: e.target.value })}
                    style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}
                    placeholder="anthropic"
                    spellCheck={false}
                    list={anthropicDatalistId}
                  />
                  <datalist id={anthropicDatalistId}>
                    {secretNames.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                  <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-3)" }}>
                    Server also falls back to <code style={{ fontSize: "0.62rem" }}>ANTHROPIC_API_KEY</code> when
                    mode is Auto and this variable is empty.
                  </p>
                  <label style={{ fontSize: "0.6875rem", color: "var(--text-3)", fontWeight: 500 }}>
                    Claude model (judge)
                  </label>
                  <input
                    value={judge.claudeModel}
                    onChange={(e) => onUpdateJudge({ ...judge, claudeModel: e.target.value })}
                    style={inputStyle}
                    placeholder={DEFAULT_JUDGE_SETTINGS.claudeModel}
                  />
                </>
              )}

              {judge.mode === "ollama" && (
                <>
                  <label style={{ fontSize: "0.6875rem", color: "var(--text-3)", fontWeight: 500 }}>
                    Ollama base URL
                  </label>
                  <input
                    value={judge.ollamaBaseUrl}
                    onChange={(e) => onUpdateJudge({ ...judge, ollamaBaseUrl: e.target.value })}
                    style={inputStyle}
                    placeholder="http://localhost:11434"
                  />
                  <label style={{ fontSize: "0.6875rem", color: "var(--text-3)", fontWeight: 500 }}>
                    Model
                  </label>
                  <input
                    value={judge.ollamaModel}
                    onChange={(e) => onUpdateJudge({ ...judge, ollamaModel: e.target.value })}
                    style={inputStyle}
                    placeholder="llama3.2"
                  />
                </>
              )}
            </div>
          )}

          {tab === "config" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-2)", lineHeight: 1.5 }}>
                Export includes <strong>secrets</strong>, models, and judge settings as YAML. Treat exports as
                sensitive. Import merges <code style={{ fontSize: "0.7rem" }}>secrets</code> and replaces{" "}
                <code style={{ fontSize: "0.7rem" }}>judge</code> / <code style={{ fontSize: "0.7rem" }}>instances</code>{" "}
                when present.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setYamlDraft(
                      exportAppConfigYaml({ secrets, judge, instances })
                    );
                    setConfigMsg("YAML generated below — copy or edit and re-import.");
                  }}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    background: "var(--text-1)",
                    color: "var(--surface)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 600,
                  }}
                >
                  Export to editor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = exportAppConfigYaml({ secrets, judge, instances });
                    void navigator.clipboard.writeText(text).then(
                      () => setConfigMsg("Copied YAML to clipboard."),
                      () => setConfigMsg("Could not copy — copy from the editor manually.")
                    );
                  }}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Copy to clipboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const parsed = parseAppConfigYaml(yamlDraft.trim() || exportAppConfigYaml({ secrets, judge, instances }));
                      const merged = mergeImportedConfig(parsed, { secrets, judge, instances });
                      onUpdateSecrets(merged.secrets);
                      onUpdateJudge(merged.judge);
                      onUpdateInstances(merged.instances);
                      setConfigMsg("Imported and saved.");
                    } catch (e) {
                      setConfigMsg(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: 4,
                    border: "1px solid var(--accent)",
                    background: "var(--accent-subtle)",
                    color: "var(--accent-text)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 600,
                  }}
                >
                  Import & apply
                </button>
              </div>
              {configMsg && (
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-2)" }}>{configMsg}</p>
              )}
              <textarea
                value={yamlDraft}
                onChange={(e) => setYamlDraft(e.target.value)}
                spellCheck={false}
                placeholder="Click “Export to editor” or paste YAML here, then Import & apply…"
                style={{
                  width: "100%",
                  minHeight: 280,
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.72rem",
                  lineHeight: 1.5,
                  padding: "0.65rem 0.75rem",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-subtle)",
                  color: "var(--text-1)",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
        </div>

        <footer
          style={{
            flexShrink: 0,
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "0.85rem 1.15rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <span style={{ fontSize: "0.78rem", color: "var(--text-3)", fontWeight: 500 }}>
            {tab === "models" && (
              <>
                {instances.length} model{instances.length !== 1 ? "s" : ""} configured
                <span style={{ display: "block", fontSize: "0.65rem", marginTop: "0.2rem", color: "var(--text-3)", opacity: 0.85 }}>
                  Edits save to this browser as you change them.
                </span>
              </>
            )}
            {tab === "secrets" && (
              <>
                {secretNames.length} secret{secretNames.length !== 1 ? "s" : ""} stored
              </>
            )}
            {tab === "judge" && "Judge configuration"}
            {tab === "config" && "YAML import / export"}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.5rem 1.15rem",
              borderRadius: "var(--r-md)",
              border: "2px solid var(--text-1)",
              background: "var(--surface)",
              color: "var(--text-1)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--text-1)";
              e.currentTarget.style.color = "var(--surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.color = "var(--text-1)";
            }}
          >
            Save changes
          </button>
        </footer>
      </aside>
    </>
  );
}
