import { useEffect, useState } from "react";
import { Commands, HermesConfig } from "../../lib/tauri";
import { useConfigStore, useUIStore } from "../../store";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";

const PROVIDERS = [
  { value: "openrouter", label: "OpenRouter（推荐）" },
  { value: "google", label: "Google Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "custom", label: "自定义端点" },
];

const MODELS = [
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4",
  "google/gemini-2.5-pro",
  "openai/gpt-4o",
  "meta-llama/llama-3.3-70b",
];

const BACKENDS: { value: HermesConfig["backend"]; label: string; disabled?: boolean }[] = [
  { value: "local", label: "本地（local）" },
  { value: "docker", label: "Docker 隔离", disabled: true },
  { value: "ssh", label: "SSH 远程", disabled: true },
  { value: "modal", label: "Modal 云端", disabled: true },
];

export function ConfigPanel() {
  const { config, setConfig } = useConfigStore();
  const { showToast } = useUIStore();
  const [local, setLocal] = useState<HermesConfig>(config);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    Commands.getConfig()
      .then((c) => { setConfig(c); setLocal(c); })
      .catch((e) => showToast("配置加载失败：" + String(e), "error"));
  }, [setConfig, showToast]);

  function update<K extends keyof HermesConfig>(key: K, value: HermesConfig[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Commands.saveConfig(local);
      if (apiKey) await Commands.saveApiKey(apiKey);
      setConfig(local);
      showToast("配置已保存", "success");
    } catch (e) {
      showToast("保存失败：" + String(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const ok = await Commands.testApiConnection(local.provider, apiKey);
      showToast(ok ? "连接成功 ✓" : "连接失败，请检查 API Key", ok ? "success" : "error");
    } catch (e) {
      showToast("测试失败：" + String(e), "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      {/* LLM Provider */}
      <section className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">LLM 提供商</h3>

        <div className="space-y-2">
          <label className="block text-[12px] text-text-1">提供商</label>
          <select
            value={local.provider}
            onChange={(e) => update("provider", e.target.value)}
            className="w-full bg-bg-3 border border-white/[0.1] rounded-md px-3 py-2 text-[12px] text-text-0"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-[12px] text-text-1">默认模型</label>
          <select
            value={local.model}
            onChange={(e) => update("model", e.target.value)}
            className="w-full bg-bg-3 border border-white/[0.1] rounded-md px-3 py-2 text-[12px] text-text-0"
          >
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-[12px] text-text-1">API Key</label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="flex-1 bg-bg-3 border border-white/[0.1] rounded-md px-3 py-2 text-[12px] text-text-0 font-mono"
            />
            <Button size="sm" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "隐藏" : "显示"}
            </Button>
            <Button size="sm" onClick={handleTestConnection} loading={testing}>
              测试连接
            </Button>
          </div>
        </div>
      </section>

      {/* Sandbox */}
      <section className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">终端沙箱</h3>
        <div className="space-y-2">
          <label className="block text-[12px] text-text-1">执行后端</label>
          <select
            value={local.backend}
            onChange={(e) => update("backend", e.target.value as HermesConfig["backend"])}
            className="w-full bg-bg-3 border border-white/[0.1] rounded-md px-3 py-2 text-[12px] text-text-0"
          >
            {BACKENDS.map((b) => (
              <option key={b.value} value={b.value} disabled={b.disabled}>
                {b.label}{b.disabled ? "（Phase 3）" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-[12px] text-text-1">内存限制（MB）</label>
          <input
            type="number"
            min={512}
            value={local.memoryLimitMb}
            onChange={(e) => update("memoryLimitMb", Number(e.target.value))}
            className="w-full bg-bg-3 border border-white/[0.1] rounded-md px-3 py-2 text-[12px] text-text-0 font-mono"
          />
        </div>
      </section>

      {/* Behaviour toggles */}
      <section className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-4">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">行为设置</h3>
        <Toggle
          label="持久记忆"
          description="跨会话保存用户偏好和项目上下文"
          checked={local.persistentMemory}
          onChange={(v) => update("persistentMemory", v)}
        />
        <Toggle
          label="自动生成技能"
          description="从对话中自动提取可复用技能片段"
          checked={local.autoSkillGeneration}
          onChange={(v) => update("autoSkillGeneration", v)}
        />
        <Toggle
          label="命令审批模式"
          description="执行终端命令前需用户手动确认（更安全）"
          checked={local.commandApproval}
          onChange={(v) => update("commandApproval", v)}
        />
        <Toggle
          label="预算压力提示"
          description="接近迭代上限时提醒 Agent 合并输出"
          checked={local.budgetWarning}
          onChange={(v) => update("budgetWarning", v)}
        />
      </section>

      <Button variant="primary" onClick={handleSave} loading={saving} className="w-full">
        保存所有配置
      </Button>
    </div>
  );
}
