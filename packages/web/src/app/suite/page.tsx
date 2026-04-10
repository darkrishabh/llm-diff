"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import type { JudgeSettings, LLMInstance, SecretsMap } from "../../types";
import { DEFAULT_JUDGE_SETTINGS } from "../../types";
import {
  loadInstances,
  saveInstances,
  loadSecrets,
  saveSecrets,
  loadJudgeSettings,
  saveJudgeSettings,
} from "../../lib/storage";
import { SettingsPanel } from "../../components/SettingsPanel";
import { BRAND_NAME, BRAND_SUITE_SUBTITLE } from "../../lib/brand";
import { LlmDiffLogo } from "../../components/LlmDiffLogo";
import { SuitePanel } from "../../components/SuitePanel";

export default function SuitePage() {
  const [instances, setInstances] = useState<LLMInstance[]>([]);
  const [secrets, setSecrets] = useState<SecretsMap>({});
  const [judge, setJudge] = useState<JudgeSettings>(DEFAULT_JUDGE_SETTINGS);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    setInstances(loadInstances());
    setSecrets(loadSecrets());
    setJudge(loadJudgeSettings());
  }, []);

  const updateInstances = (next: LLMInstance[]) => {
    setInstances(next);
    saveInstances(next);
  };

  const updateSecrets = (next: SecretsMap) => {
    setSecrets(next);
    saveSecrets(next);
  };

  const updateJudge = (next: JudgeSettings) => {
    setJudge(next);
    saveJudgeSettings(next);
  };

  const enabled = instances.filter((i) => i.enabled);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-gradient)" }}>
      <header
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 30,
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "0 1.5rem",
            minHeight: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
              <Link
                href="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  textDecoration: "none",
                  color: "var(--text-1)",
                }}
              >
                <LlmDiffLogo size={30} />
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {BRAND_NAME}
                </span>
              </Link>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  color: "var(--text-3)",
                  letterSpacing: "0.04em",
                }}
              >
                Test suites
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-3)", fontWeight: 500 }}>
              {BRAND_SUITE_SUBTITLE}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexShrink: 0 }}>
            <Link
              href="/"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--text-2)",
                textDecoration: "none",
                padding: "0.45rem 0.85rem",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                boxShadow: "var(--shadow-xs)",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              ← Compare
            </Link>
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "0.8125rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontFamily: "inherit",
                transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
                boxShadow: "var(--shadow-xs)",
                flexShrink: 0,
              }}
            >
              Settings
              {enabled.length > 0 && (
                <span
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    borderRadius: 999,
                    minWidth: 22,
                    height: 22,
                    padding: "0 6px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {enabled.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "1.75rem 1.5rem 3rem" }}>
        <SuitePanel
          instances={instances}
          secrets={secrets}
          judge={judge}
          onOpenSettings={() => setConfigOpen(true)}
        />
      </main>

      {configOpen && (
        <SettingsPanel
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          instances={instances}
          onUpdateInstances={updateInstances}
          secrets={secrets}
          onUpdateSecrets={updateSecrets}
          judge={judge}
          onUpdateJudge={updateJudge}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
