import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands, HermesConfig } from "../../lib/tauri";
import { useConfigStore, useUIStore } from "../../store";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";

const PROVIDERS: { value: string; labelKey: string }[] = [
  { value: "openrouter", labelKey: "config.providers.openrouter" },
  { value: "google",     labelKey: "config.providers.google" },
  { value: "openai",     labelKey: "config.providers.openai" },
  { value: "anthropic",  labelKey: "config.providers.anthropic" },
  { value: "custom",     labelKey: "config.providers.custom" },
];

const MODELS = [
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4",
  "google/gemini-2.5-pro",
  "openai/gpt-4o",
  "meta-llama/llama-3.3-70b",
];

const LANGUAGE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "system", labelKey: "config.languages.system" },
  { value: "zh",     labelKey: "config.languages.zh" },
  { value: "en",     labelKey: "config.languages.en" },
];

const INPUT_CLASS =
  "w-full bg-bg-window border border-bg-secondary rounded-[8px] px-3 py-2 text-[13px] text-text-primary " +
  "focus:outline-none focus:border-[1.5px] focus:border-accent";
const LABEL_CLASS = "block text-[12px] text-text-secondary font-[500] mb-[5px]";

export function ConfigPanel() {
  const { t, i18n } = useTranslation();
  const { config, configLoaded, setConfig } = useConfigStore();
  const { showToast } = useUIStore();
  const [local, setLocal] = useState<HermesConfig>(config);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let active = true;
    Commands.getConfig()
      .then((c) => {
        if (active) {
          setConfig(c);
          setLocal(c);
        }
      })
      .catch((e) => {
        if (active) {
          const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
          showToast(`${t("toast.configLoadFailed")}: ${msg}`, "error");
        }
      });
    return () => { active = false; };
  }, [setConfig, showToast, t]);

  function update<K extends keyof HermesConfig>(key: K, value: HermesConfig[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Commands.saveConfig(local);
      if (apiKey) await Commands.saveApiKey(apiKey);
      setConfig(local);
      showToast(t("toast.configSaved"), "success");

      // Apply language change after successful save
      const lang = local.language ?? "system";
      if (lang === "system") {
        try {
          const locale = await Commands.getSystemLocale();
          await i18n.changeLanguage(locale.startsWith("zh") ? "zh" : "en");
        } catch {
          await i18n.changeLanguage("en");
        }
      } else {
        await i18n.changeLanguage(lang);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("toast.saveFailed")}: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const ok = await Commands.testApiConnection(local.provider, apiKey);
      showToast(
        ok ? t("toast.connectionOk") : t("toast.connectionFail"),
        ok ? "success" : "error"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("toast.testFailed")}: ${msg}`, "error");
    } finally {
      setTesting(false);
    }
  }

  if (!configLoaded) {
    return (
      <div className="flex items-center justify-center h-32 text-text-secondary text-[13px]">
        Loading...
      </div>
    );
  }

  const modelOptions = MODELS.includes(local.model) ? MODELS : [local.model, ...MODELS];

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        {/* LLM config card */}
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)] space-y-3">
          <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase">
            {t("config.llmSection")}
          </div>

          <div>
            <label htmlFor="provider-select" className={LABEL_CLASS}>{t("config.providerLabel")}</label>
            <select
              id="provider-select"
              value={local.provider}
              onChange={(e) => update("provider", e.target.value)}
              className={INPUT_CLASS}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="model-select" className={LABEL_CLASS}>{t("config.modelLabel")}</label>
            <select
              id="model-select"
              value={local.model}
              onChange={(e) => update("model", e.target.value)}
              className={INPUT_CLASS}
            >
              {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="api-key-input" className={LABEL_CLASS}>{t("config.apiKeyLabel")}</label>
            <div className="flex gap-2 mb-2">
              <input
                id="api-key-input"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className={`${INPUT_CLASS} flex-1 font-mono`}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? t("config.hideKey") : t("config.showKey")}
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleTestConnection}
              loading={testing}
              className="w-full"
            >
              {t("config.testConnection")}
            </Button>
          </div>
        </div>

        {/* Behavior settings card */}
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
            {t("config.behaviorSection")}
          </div>
          <div className="space-y-4 divide-y divide-bg-secondary">
            <Toggle
              label={t("config.persistentMemory")}
              description={t("config.persistentMemoryDesc")}
              checked={local.persistentMemory}
              onChange={(v) => update("persistentMemory", v)}
            />
            <div className="pt-3">
              <Toggle
                label={t("config.autoSkillGen")}
                description={t("config.autoSkillGenDesc")}
                checked={local.autoSkillGeneration}
                onChange={(v) => update("autoSkillGeneration", v)}
              />
            </div>
            <div className="pt-3">
              <Toggle
                label={t("config.commandApproval")}
                description={t("config.commandApprovalDesc")}
                checked={local.commandApproval}
                onChange={(v) => update("commandApproval", v)}
              />
            </div>
            <div className="pt-3">
              <Toggle
                label={t("config.budgetWarning")}
                description={t("config.budgetWarningDesc")}
                checked={local.budgetWarning}
                onChange={(v) => update("budgetWarning", v)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* General settings card — language */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
          {t("config.generalSection")}
        </div>
        <div style={{ maxWidth: 280 }}>
          <label htmlFor="language-select" className={LABEL_CLASS}>{t("config.languageLabel")}</label>
          <select
            id="language-select"
            value={local.language ?? "system"}
            onChange={(e) => update("language", e.target.value)}
            className={INPUT_CLASS}
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Save button */}
      <Button
        type="button"
        variant="primary"
        onClick={handleSave}
        loading={saving}
        className="w-full rounded-[10px] py-3 text-[14px]"
      >
        {t("config.saveAll")}
      </Button>
    </div>
  );
}
