// src/features/model/ModelPanel.tsx
import { useEffect, useState } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { Commands } from "../../lib/tauri";
import { useStore } from "../../store";
import { useLang } from "../../i18n";

// Providers from Hermes config.yaml — values must match exactly
const PROVIDERS = [
  { value: "auto",         label: "Auto（自动检测）" },
  { value: "openrouter",   label: "OpenRouter" },
  { value: "anthropic",    label: "Anthropic" },
  { value: "gemini",       label: "Google Gemini" },
  { value: "nous",         label: "Nous Portal（OAuth）" },
  { value: "nous-api",     label: "Nous Portal（API Key）" },
  { value: "openai-codex", label: "OpenAI Codex" },
  { value: "copilot",      label: "GitHub Copilot" },
  { value: "zai",          label: "z.ai / ZhipuAI GLM" },
  { value: "kimi-coding",  label: "Kimi / Moonshot AI" },
  { value: "minimax",      label: "MiniMax（Global）" },
  { value: "minimax-cn",   label: "MiniMax（中国）" },
  { value: "huggingface",  label: "Hugging Face" },
  { value: "xiaomi",       label: "小米 MiMo" },
  { value: "arcee",        label: "Arcee AI" },
  { value: "ollama-cloud", label: "Ollama Cloud" },
  { value: "kilocode",     label: "KiloCode" },
  { value: "ai-gateway",   label: "Vercel AI Gateway" },
  { value: "ollama",       label: "Ollama（本地）" },
  { value: "lmstudio",     label: "LM Studio（本地）" },
  { value: "custom",       label: "Custom OpenAI-compatible" },
];

// Common model suggestions per provider (user can also type any model freely)
const MODEL_SUGGESTIONS: Record<string, string[]> = {
  auto:         ["anthropic/claude-opus-4.6", "anthropic/claude-sonnet-4-5", "openai/gpt-4o"],
  openrouter:   ["anthropic/claude-opus-4.6", "anthropic/claude-sonnet-4-5", "openai/gpt-4o", "google/gemini-2.5-pro", "google/gemini-2.5-flash"],
  anthropic:    ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
  gemini:       ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  nous:         ["hermes-3-70b", "hermes-3-405b"],
  "nous-api":   ["hermes-3-70b", "hermes-3-405b"],
  "openai-codex": ["codex-mini-latest", "o4-mini"],
  copilot:      ["gpt-4o", "claude-sonnet-4-5", "gemini-2.5-pro"],
  zai:          ["glm-4-plus", "glm-z1-air"],
  "kimi-coding": ["kimi-k2-0711-preview", "moonshot-v1-8k"],
  minimax:      ["MiniMax-Text-01", "abab6.5s-chat"],
  "minimax-cn": ["MiniMax-Text-01"],
  ollama:       ["llama3.3", "qwen2.5-coder:32b", "deepseek-r1:32b"],
  lmstudio:     ["local-model"],
  custom:       [],
};

const INPUT: React.CSSProperties = {
  width: "100%",
  background: "#F8F8FC",
  border: "2px solid #E8E8F5",
  borderRadius: P.radius.sm,
  padding: "9px 12px",
  fontSize: 13,
  color: P.ink,
  fontFamily: "Nunito,sans-serif",
};

const LABEL: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 800,
  color: P.soft, letterSpacing: 0.5, marginBottom: 5, textTransform: "uppercase",
};

export function ModelPanel() {
  const { t } = useLang();
  const { config, setConfig, showToast } = useStore();
  const [local, setLocal] = useState(config);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Commands.getConfig().then(c => {
      const storeConfig = {
        provider: c.provider,
        model: c.model,
        memoryLimitMb: c.memoryLimitMb,
        persistentMemory: c.persistentMemory,
        autoSkillGeneration: c.autoSkillGeneration,
        commandApproval: c.commandApproval,
        budgetWarning: c.budgetWarning,
        language: c.language,
      };
      setConfig(storeConfig);
      setLocal(storeConfig);
    }).catch(() => {});
  }, [setConfig]);

  const modelSuggestions = MODEL_SUGGESTIONS[local.provider] ?? [];

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const fullConfig = { ...local, backend: "local" as const };
      await Commands.saveConfig(fullConfig);
      if (apiKey) await Commands.saveApiKey(apiKey);
      setConfig(local);
      setMsg(t.model.saved);
      showToast(t.model.saved, "success");
    } catch (e) {
      setMsg(`${t.model.saveFailed}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMsg("");
    try {
      const ok = await Commands.testApiConnection(local.provider, apiKey);
      setMsg(ok ? t.model.connOk : t.model.connFail);
    } catch {
      setMsg(t.model.connFail);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={{
      background: P.white, borderRadius: P.radius.xl,
      padding: "20px 24px", marginBottom: 12,
      boxShadow: P.shadow.panel, border: `2px solid ${P.border}`,
    }}>
      <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink, marginBottom: 4 }}>
        {t.model.title}
      </div>
      <div style={{ fontSize: 12, color: P.soft, marginBottom: 16 }}>{t.model.desc}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={LABEL}>{t.model.provider}</label>
          <select
            value={local.provider}
            onChange={e => setLocal(prev => ({ ...prev, provider: e.target.value, model: MODEL_SUGGESTIONS[e.target.value]?.[0] ?? "" }))}
            style={INPUT}
          >
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label style={LABEL}>{t.model.model}</label>
          <input
            list="model-suggestions"
            value={local.model}
            onChange={e => setLocal(prev => ({ ...prev, model: e.target.value }))}
            placeholder="anthropic/claude-opus-4.6"
            style={INPUT}
          />
          <datalist id="model-suggestions">
            {modelSuggestions.map(m => <option key={m} value={m} />)}
          </datalist>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>{t.model.apiKey}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={t.model.placeholder}
            style={{ ...INPUT, flex: 1, fontFamily: "monospace" }}
          />
          <Btn small ghost onClick={() => setShowKey(v => !v)}>
            {showKey ? t.model.hideKey : t.model.showKey}
          </Btn>
          <Btn small ghost onClick={handleTest} loading={testing}>
            {t.model.testConn}
          </Btn>
        </div>
      </div>

      {msg && (
        <div style={{
          marginBottom: 12, fontSize: 12, fontWeight: 700,
          color: /(ok|成功)/i.test(msg) ? P.teal : P.coral,
        }}>
          {msg}
        </div>
      )}

      <Btn color={P.indigo} onClick={handleSave} loading={saving} style={{ width: "100%" }}>
        {t.model.save}
      </Btn>
    </div>
  );
}
