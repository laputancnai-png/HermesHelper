// src/features/model/ModelPanel.tsx
import { useEffect, useState } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { Commands } from "../../lib/tauri";
import { useStore } from "../../store";
import { useLang } from "../../i18n";

// ── Provider registry ─────────────────────────────────────────────────────────

type ProviderCategory = "cloud" | "local";

interface ProviderMeta {
  value: string;
  label: string;
  emoji: string;
  category: ProviderCategory;
  desc: string;
  keyPlaceholder?: string;
  tips?: string;
}

const PROVIDERS: ProviderMeta[] = [
  { value: "nvidia",   label: "NVIDIA NIM", emoji: "💚", category: "cloud", desc: "NVIDIA NIM 推理平台", keyPlaceholder: "nvapi-...", tips: "仅写入 ~/.hermes/.env 的 NVIDIA_API_KEY；config.yaml 使用内置 nvidia provider（不写明文 key）" },
  { value: "ollama",   label: "Ollama",     emoji: "🦙", category: "local", desc: "本地 Ollama 运行时" },
  { value: "lmstudio", label: "LM Studio",  emoji: "🖥️", category: "local", desc: "LM Studio 本地推理" },
];

// ── Model suggestions per provider ────────────────────────────────────────────

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  nvidia:   ["qwen/qwen3-next-80b-a3b-instruct", "qwen/qwen3-coder-480b-a35b-instruct"],
  ollama:   ["llama3.3", "qwen2.5-coder:32b", "deepseek-r1:32b"],
  lmstudio: ["local-model"],
};

// ── Nvidia YAML patch builder ─────────────────────────────────────────────────

const NVIDIA_API = "https://integrate.api.nvidia.com/v1";

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

// ── Category tab config ───────────────────────────────────────────────────────

const CATS = [
  { id: "all",   label: "全部",   color: P.indigo, bg: P.indigo, textActive: "#fff" },
  { id: "cloud", label: "☁️ 云端", color: "#2AA8D8", bg: "#DCF5FF", textActive: P.ink },
  { id: "local", label: "🏠 本地", color: "#18B989", bg: "#D8F7EC", textActive: P.ink },
] as const;

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
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | "cloud" | "local">("all");

  useEffect(() => {
    Commands.getConfig().then(c => {
      const s = {
        provider: c.provider,
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
    }).catch(() => {});
  }, [setConfig]);

  const selectedMeta = PROVIDERS.find(p => p.value === local.provider);
  const modelSuggestions = MODEL_SUGGESTIONS[local.provider] ?? [];

  const filteredProviders = PROVIDERS.filter(p => {
    const matchCat = catFilter === "all" || p.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  function handleProviderSelect(value: string) {
    const firstModel = MODEL_SUGGESTIONS[value]?.[0] ?? "";
    setLocal(prev => ({ ...prev, provider: value, model: firstModel }));
    setMsg("");
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    setSaveOk(false);
    try {
      const fullConfig = { ...local, backend: "local" as const };
      await Commands.saveConfig(fullConfig);
      if (apiKey.trim()) {
        await Commands.saveApiKey(local.provider, apiKey.trim());
      }
      if (local.provider === "nvidia") {
        await Commands.applyProviderYamlPatch(buildNvidiaYamlPatch(local.model));
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

      {/* Search */}
      <input
        type="text"
        placeholder="搜索提供商..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "11px 14px", borderRadius: P.radius.md,
          border: "2px solid #EBEBF8", fontSize: 13, outline: "none",
          background: P.white, marginBottom: 14, boxSizing: "border-box",
        }}
      />

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #E8E8F5", paddingBottom: 12, overflowX: "auto" }}>
        {CATS.map(cat => {
          const active = catFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCatFilter(cat.id as typeof catFilter)}
              style={{
                padding: "7px 14px", borderRadius: P.radius.md,
                border: active ? `2px solid ${cat.color}` : "2px solid #E8E8F5",
                background: active ? (cat.id === "all" ? P.indigo : cat.bg) : P.white,
                color: active ? (cat.id === "all" ? "#fff" : P.ink) : P.soft,
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                transition: "all 0.14s", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Provider card grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3,1fr)",
        gap: 10, marginBottom: 18, maxHeight: 300, overflowY: "auto", paddingRight: 4,
      }}>
        {filteredProviders.map(p => {
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
                  <div style={{
                    fontSize: 10, color: p.category === "local" ? P.teal : "#2AA8D8",
                    fontWeight: 600, marginTop: 2,
                  }}>
                    {p.category === "local" ? "🏠 本地" : "☁️ 云端"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: P.soft, lineHeight: 1.4 }}>{p.desc}</div>
            </div>
          );
        })}
        {filteredProviders.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "32px 16px", color: P.soft, fontSize: 13 }}>
            未找到匹配的提供商
          </div>
        )}
      </div>

      {/* Selected provider config */}
      {selectedMeta && (
        <div style={{ borderTop: "2px solid #F0F0FA", paddingTop: 18 }}>

          {/* API Key */}
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
                placeholder={selectedMeta.keyPlaceholder ?? "sk-..."}
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

          {/* Model */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: P.soft, marginBottom: 8, letterSpacing: 0.3 }}>
              {t.model.model}
            </div>
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
            <datalist id="model-suggestions">
              {modelSuggestions.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>

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
        <Btn color={P.teal} onClick={handleSave} loading={saving}>
          {t.model.save}
        </Btn>
      </div>
    </div>
  );
}
