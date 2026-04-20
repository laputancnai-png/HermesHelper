// src/features/model/ModelPanel.tsx
import { useCallback, useEffect, useState } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { Commands, OllamaInstallStatus, OllamaModel } from "../../lib/tauri";
import { useStore } from "../../store";
import { useLang } from "../../i18n";

// ── Provider registry ─────────────────────────────────────────────────────────

interface ProviderMeta {
  value: string;
  label: string;
  emoji: string;
  desc: string;
  keyPlaceholder?: string;
  tips?: string;
}

const PROVIDERS: ProviderMeta[] = [
  { value: "nvidia", label: "NVIDIA NIM", emoji: "💚", desc: "NVIDIA NIM 推理平台", keyPlaceholder: "nvapi-...", tips: "仅写入 ~/.hermes/.env 的 NVIDIA_API_KEY；config.yaml 使用内置 nvidia provider（不写明文 key）" },
  { value: "ollama", label: "Ollama", emoji: "🦙", desc: "本地 Ollama 运行时" },
];

// ── Model suggestions per provider ────────────────────────────────────────────

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  nvidia: ["qwen/qwen3-next-80b-a3b-instruct", "qwen/qwen3-coder-480b-a35b-instruct"],
  ollama: [],
};

// ── Nvidia YAML patch builder ─────────────────────────────────────────────────

const NVIDIA_API = "https://integrate.api.nvidia.com/v1";
const OLLAMA_API = "http://127.0.0.1:11434/v1";

function buildNvidiaYamlPatch(model: string): string {
  const esc = (s: string) => s.replace(/"/g, '\\"');

  // model: block uses Hermes built-in nvidia provider; secrets stay in .env only.
  const lines = [
    "model:",
    "  provider: nvidia",
    `  default: "${esc(model)}"`,
    `  base_url: "${NVIDIA_API}"`,
    "  api_mode: chat_completions",
  ];

  return lines.join("\n");
}

function buildOllamaYamlPatch(model: string): string {
  const esc = (s: string) => s.replace(/"/g, '\\"');

  // Use local OpenAI-compatible endpoint; avoid stale remote base_url from other providers.
  const lines = [
    "model:",
    "  provider: custom",
    `  default: "${esc(model)}"`,
    `  base_url: "${OLLAMA_API}"`,
    "  api_mode: chat_completions",
  ];

  return lines.join("\n");
}

function formatSize(bytes: number): string {
  if (!bytes) return "unknown";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }
  return idx === 0 ? `${size} ${units[idx]}` : `${size.toFixed(1)} ${units[idx]}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ModelPanel() {
  const { t } = useLang();
  const { config, setConfig } = useStore();
  const [local, setLocal] = useState(config);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [saveOk, setSaveOk] = useState(false);

  // Ollama-specific states
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [ollamaInstallStatus, setOllamaInstallStatus] = useState<OllamaInstallStatus | null>(null);
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [loadingOllama, setLoadingOllama] = useState(false);
  const [ollamaError, setOllamaError] = useState("");

  const loadProviderKey = useCallback(async (provider: string) => {
    const meta = PROVIDERS.find(p => p.value === provider);
    if (!meta?.keyPlaceholder) {
      setApiKey("");
      setShowKey(false);
      return;
    }

    try {
      const saved = await Commands.getApiKey(provider);
      setApiKey(saved ?? "");
    } catch {
      setApiKey("");
    }
  }, []);

  // Check Ollama status and load models when provider changes
  const checkOllamaAndLoadModels = useCallback(async () => {
    if (local.provider !== "ollama") {
      setOllamaInstalled(null);
      setOllamaInstallStatus(null);
      setOllamaRunning(false);
      setOllamaModels([]);
      return;
    }

    setLoadingOllama(true);
    setOllamaError("");

    try {
      const installStatus = await Commands.getOllamaInstallStatus();
      setOllamaInstallStatus(installStatus);
      const installed = installStatus.canAttemptStart;
      setOllamaInstalled(installed);
      if (!installed) {
        setOllamaRunning(false);
        setOllamaModels([]);
        return;
      }

      const isRunning = await Commands.checkOllamaStatus();
      setOllamaRunning(isRunning);

      if (isRunning) {
        try {
          const models = await Commands.getOllamaModels();
          setOllamaModels(models);
          // Auto-select first model if none selected
          if (!local.model && models.length > 0) {
            setLocal(prev => ({ ...prev, model: models[0].name }));
          }
        } catch (e) {
          setOllamaError(`加载模型失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      setOllamaError(`检查服务状态失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingOllama(false);
    }
  }, [local.provider, local.model]);

  useEffect(() => {
    Commands.getConfig().then(c => {
      const uiProvider = c.provider === "custom" ? "ollama" : c.provider;
      const s = {
        provider: uiProvider,
        model: c.model,
        memoryLimitMb: c.memoryLimitMb,
        persistentMemory: c.persistentMemory,
        autoSkillGeneration: c.autoSkillGeneration,
        commandApproval: c.commandApproval,
        budgetWarning: c.budgetWarning,
        language: c.language,
      };
      setConfig(s);
      setLocal(s);
      void loadProviderKey(s.provider);
    }).catch(() => {});
  }, [setConfig]);

  useEffect(() => {
    void checkOllamaAndLoadModels();
  }, [local.provider]);

  const selectedMeta = PROVIDERS.find(p => p.value === local.provider);
  const modelSuggestions = local.provider === "ollama" ? [] : (MODEL_SUGGESTIONS[local.provider] ?? []);

  function handleProviderSelect(value: string) {
    const firstModel = MODEL_SUGGESTIONS[value]?.[0] ?? "";
    setLocal(prev => ({ ...prev, provider: value, model: firstModel }));
    void loadProviderKey(value);
    setMsg("");
    setOllamaError("");
  }

  async function handleStartOllama() {
    setLoadingOllama(true);
    setOllamaError("");

    try {
      const result = await Commands.startOllamaService();
      setMsg(result);
      setSaveOk(true);

      // Give Ollama a moment to start, then check status
      setTimeout(() => {
        void checkOllamaAndLoadModels();
      }, 1000);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setOllamaError(raw.startsWith("启动失败") || raw.startsWith("无法启动") ? raw : `启动失败: ${raw}`);
    } finally {
      setLoadingOllama(false);
    }
  }

  async function handleSave() {
    if (!local.model) {
      setMsg("请先选择一个模型");
      setSaveOk(false);
      return;
    }

    setSaving(true);
    setMsg("");
    setSaveOk(false);
    try {
      const fullConfig = { ...local, backend: "local" as const };
      await Commands.saveConfig(fullConfig);
      if (selectedMeta?.keyPlaceholder) {
        if (apiKey.trim()) {
          await Commands.saveApiKey(local.provider, apiKey.trim());
        } else {
          await Commands.removeApiKey(local.provider);
        }
      }
      if (local.provider === "nvidia") {
        await Commands.applyProviderYamlPatch(buildNvidiaYamlPatch(local.model));
      } else if (local.provider === "ollama") {
        await Commands.applyProviderYamlPatch(buildOllamaYamlPatch(local.model));
      }
      setConfig(local);
      setSaveOk(true);
      setMsg(t.model.saved);
    } catch (e) {
      setSaveOk(false);
      setMsg(`${t.model.saveFailed}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: P.white, borderRadius: 22, padding: "28px 32px",
      boxShadow: "0 8px 24px #00000010",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🤖</div>
        <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 22, color: P.ink }}>{t.model.title}</div>
        <div style={{ fontSize: 13, color: P.soft, marginTop: 6 }}>{t.model.desc}</div>
      </div>

      {/* Provider card grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(2,1fr)",
        gap: 10, marginBottom: 18, maxHeight: 300, overflowY: "auto", paddingRight: 4,
      }}>
        {PROVIDERS.map(p => {
          const active = local.provider === p.value;
          return (
            <div
              key={p.value}
              onClick={() => handleProviderSelect(p.value)}
              style={{
                background: active ? "#EEF0FF" : P.white,
                border: `2px solid ${active ? P.indigo : "#E8E8F5"}`,
                borderRadius: 14, padding: "12px 10px", cursor: "pointer",
                transition: "all 0.14s",
                boxShadow: active ? `0 4px 12px ${P.indigo}33` : "0 1px 4px #0000000A",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "#FAFAFE"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = P.white; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{p.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: P.ink, wordBreak: "break-word", lineHeight: 1.3 }}>{p.label}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: P.soft, lineHeight: 1.4 }}>{p.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Selected provider config */}
      {selectedMeta && (
        <div style={{ borderTop: "2px solid #F0F0FA", paddingTop: 18 }}>

          {/* API Key */}
          {selectedMeta.keyPlaceholder && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.soft, marginBottom: 8, letterSpacing: 0.3 }}>
                {t.model.apiKey}
                <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>（首次配置时填写）</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={selectedMeta.keyPlaceholder}
                  style={{
                    flex: 1, padding: "11px 14px", borderRadius: P.radius.md,
                    border: "2px solid #EBEBF8", fontSize: 13, outline: "none",
                    fontFamily: "monospace", background: P.white,
                  }}
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  style={{
                    padding: "0 14px", borderRadius: P.radius.md, border: "2px solid #EBEBF8",
                    background: P.white, color: P.soft, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {showKey ? t.model.hideKey : t.model.showKey}
                </button>
              </div>
            </div>
          )}

          {/* Ollama Service Control */}
          {local.provider === "ollama" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.soft, marginBottom: 8, letterSpacing: 0.3 }}>
                服务状态
              </div>

              {loadingOllama ? (
                <div style={{ padding: "12px 14px", background: "#F5F5FF", borderRadius: P.radius.md, color: P.soft, fontSize: 13 }}>
                  ⏳ 检查中...
                </div>
              ) : ollamaInstalled === false ? (
                <div style={{
                  padding: "12px 14px", background: "#FFF0EE", borderRadius: P.radius.md,
                  color: P.coral, fontSize: 12, lineHeight: 1.6,
                  border: "2px solid #FFCCCC", fontWeight: 600,
                }}>
                  <div style={{ marginBottom: 6 }}>⚠️ 本机未检测到 Ollama</div>
                  <div style={{ fontWeight: 500 }}>
                    请先安装 Ollama，然后下载需要的大模型再回来配置。
                  </div>
                  <div style={{ marginTop: 6, fontFamily: "monospace", whiteSpace: "pre-wrap", fontWeight: 500 }}>
                    macOS: brew install ollama{"\n"}
                    Linux: curl -fsSL https://ollama.com/install.sh | sh{"\n"}
                    下载模型: ollama pull &lt;model_name&gt;
                  </div>
                </div>
              ) : ollamaInstallStatus && !ollamaInstallStatus.cliAvailable ? (
                <div style={{
                  padding: "12px 14px", background: "#FFF8E8", borderRadius: P.radius.md,
                  color: "#B87803", fontSize: 12, lineHeight: 1.6,
                  border: "2px solid #FFE066", fontWeight: 600,
                }}>
                  <div style={{ marginBottom: 6 }}>ℹ️ 检测到 Ollama App，可尝试直接启动</div>
                  <div style={{ fontWeight: 500 }}>
                    若你希望在终端使用 `ollama pull` 下载/管理模型，请再安装 CLI。
                  </div>
                </div>
              ) : ollamaRunning ? (
                <div style={{ padding: "12px 14px", background: "#E8FFF5", borderRadius: P.radius.md, color: P.teal, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>✓</span> Ollama 已运行
                </div>
              ) : (
                <Btn color={P.coral} onClick={handleStartOllama} loading={loadingOllama}>
                  🚀 启动 Ollama
                </Btn>
              )}
            </div>
          )}

          {/* Model selection - Ollama: from live list or input */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: P.soft, marginBottom: 8, letterSpacing: 0.3 }}>
              {t.model.model}
            </div>

            {local.provider === "ollama" && ollamaInstalled === false ? (
              <div style={{ padding: "12px 14px", background: "#FFF7E8", borderRadius: P.radius.md, color: "#B87803", fontSize: 13, fontWeight: 600 }}>
                请先安装 Ollama 并执行 `ollama pull` 下载模型
              </div>
            ) : local.provider === "ollama" && ollamaRunning ? (
              ollamaModels.length > 0 ? (
                <select
                  value={local.model}
                  onChange={e => setLocal(prev => ({ ...prev, model: e.target.value }))}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: P.radius.md,
                    border: "2px solid #EBEBF8", fontSize: 13, outline: "none",
                    background: P.white, boxSizing: "border-box", fontFamily: "monospace",
                  }}
                >
                  <option value="">-- 选择一个模型 --</option>
                  {ollamaModels.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.name} {m.size ? `(${formatSize(m.size)})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: "12px 14px", background: "#FFF0EE", borderRadius: P.radius.md, color: P.coral, fontSize: 13, fontWeight: 600 }}>
                  ⚠️ 没有找到本地模型，请先用 `ollama pull` 下载
                </div>
              )
            ) : (
              <input
                list="model-suggestions"
                value={local.model}
                onChange={e => setLocal(prev => ({ ...prev, model: e.target.value }))}
                placeholder={modelSuggestions[0] ?? "model name"}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: P.radius.md,
                  border: "2px solid #EBEBF8", fontSize: 13, outline: "none",
                  background: P.white, boxSizing: "border-box", fontFamily: "monospace",
                }}
              />
            )}
            <datalist id="model-suggestions">
              {modelSuggestions.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>

          {/* Ollama error */}
          {ollamaError && (
            <div style={{
              padding: "10px 14px", background: "#FFF0EE", borderRadius: P.radius.md,
              color: P.coral, fontSize: 12, lineHeight: 1.5,
              border: "2px solid #FFCCCC", marginBottom: 14, fontWeight: 500,
            }}>
              ⚠️ {ollamaError}
            </div>
          )}

          {/* Tips */}
          {selectedMeta.tips && (
            <div style={{
              padding: "10px 14px", background: "#FFF8E8", borderRadius: P.radius.md,
              color: "#B87803", fontSize: 12, lineHeight: 1.5,
              border: "2px solid #FFE066", marginBottom: 14, fontWeight: 500,
            }}>
              💡 {selectedMeta.tips}
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {msg && (
        <div style={{
          padding: "10px 14px", marginBottom: 12, borderRadius: P.radius.md,
          background: saveOk ? "#E8FFF5" : "#FFF0EE",
          color: saveOk ? P.teal : P.coral,
          fontSize: 13, fontWeight: 700,
        }}>
          {msg}
        </div>
      )}

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <Btn color={P.teal} onClick={handleSave} loading={saving} disabled={local.provider === "ollama" && (ollamaInstalled !== true || !ollamaRunning)}>
          {t.model.save}
        </Btn>
      </div>
    </div>
  );
}
