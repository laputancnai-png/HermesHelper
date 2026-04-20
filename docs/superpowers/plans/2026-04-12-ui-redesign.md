# Hermes Manager UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark "cyberpunk" UI with an Apple-style light design and add Chinese/English i18n support.

**Architecture:** All CSS design tokens in `src/index.css` are replaced with Apple light-mode values; `react-i18next` provides translations loaded from `src/locales/zh|en/translation.json`; every component is rewritten in-place; the Sidebar navigation is replaced by a Segmented Control in the title bar; a new Rust command `get_system_locale` detects the OS language on startup.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS v4, react-i18next + i18next, Tauri 2 (Rust), Zustand (unchanged), Vitest + @testing-library/react

**Worktree:** `/Users/laputancnai/HermesHelper/.worktrees/feature/phase1/`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Replace | `src/index.css` | Apple light-mode design tokens |
| Create | `src/locales/zh/translation.json` | Chinese translations |
| Create | `src/locales/en/translation.json` | English translations |
| Create | `src/lib/i18n.ts` | i18next initializer |
| Modify | `src/lib/tauri.ts` | Add `language` to HermesConfig; add `getSystemLocale` command |
| Modify | `src-tauri/src/commands/config.rs` | Add `language` field; add `get_system_locale` command |
| Modify | `src-tauri/src/lib.rs` | Register `get_system_locale` |
| Create | `src/components/layout/SegmentedControl.tsx` | Tab navigation |
| Replace | `src/components/layout/Topbar.tsx` | Traffic lights + app title row |
| Replace | `src/App.tsx` | Remove Sidebar, add title bar + SegmentedControl |
| Delete | `src/components/layout/Sidebar.tsx` | No longer needed |
| Replace | `src/components/ui/Button.tsx` | Apple-style variants |
| Replace | `src/components/ui/Badge.tsx` | Apple status colors |
| Replace | `src/components/ui/Toggle.tsx` | iOS 51×31px style |
| Replace | `src/components/ui/LogLine.tsx` | Emoji icon rows |
| Replace | `src/components/ui/Toast.tsx` | Left color-bar style |
| Replace | `src/components/panels/HomePanel.tsx` | Card-grid layout with i18n |
| Replace | `src/components/panels/InstallPanel.tsx` | Apple radio + progress with i18n |
| Replace | `src/components/panels/ConfigPanel.tsx` | 2-col cards + language selector |
| Modify | `src/__tests__/setup.ts` | Add react-i18next mock |
| Modify | `src/__tests__/panels/HomePanel.test.tsx` | Update for i18n key strings |
| Modify | `src/__tests__/panels/InstallPanel.test.tsx` | Update for i18n key strings |
| Modify | `src/__tests__/panels/ConfigPanel.test.tsx` | Update + language selector test |
| Modify | `src/__tests__/ui/Toggle.test.tsx` | Add iOS style assertion |

---

## Task 1: Install i18n packages

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install packages**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npm install react-i18next i18next
```

Expected output: `added 2 packages` (approximately)

- [ ] **Step 2: Verify install**

```bash
node -e "require('react-i18next'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-i18next and i18next dependencies"
```

---

## Task 2: Replace CSS design tokens

**Files:**
- Replace: `src/index.css`

- [ ] **Step 1: Write the test (verify tokens exist after replacement)**

The test is implicit — Vitest will fail if any component imports a non-existent token. Run before replacing:

```bash
npm test -- --run 2>&1 | tail -5
```

Expected: all 13 tests pass (baseline check)

- [ ] **Step 2: Replace `src/index.css` with Apple light-mode tokens**

```css
@import "tailwindcss";

@theme {
  /* Backgrounds */
  --color-bg-window:    #F2F2F7;
  --color-bg-card:      #FFFFFF;
  --color-bg-secondary: #E5E5EA;
  --color-bg-tertiary:  #D1D1D6;

  /* Text */
  --color-text-primary:     #1D1D1F;
  --color-text-secondary:   #424245;
  --color-text-tertiary:    #6C6C70;
  --color-text-placeholder: #8E8E93;

  /* Accent */
  --color-accent:       #30B0C7;
  --color-accent-light: #E8F8FB;

  /* Status colors */
  --color-status-green:  #34C759;
  --color-status-yellow: #FF9F0A;
  --color-status-red:    #FF3B30;

  /* Status backgrounds */
  --color-status-green-bg:  #E8F9F0;
  --color-status-yellow-bg: #FFF8E6;
  --color-status-red-bg:    #FFF0F0;

  /* Border radius */
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   14px;
  --radius-pill: 20px;
}

*, *::before, *::after {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  background: #F2F2F7;
  color: #1D1D1F;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

::-webkit-scrollbar        { width: 4px; height: 4px; }
::-webkit-scrollbar-track  { background: transparent; }
::-webkit-scrollbar-thumb  { background: #D1D1D6; border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: #C7C7CC; }

@keyframes fade-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.animate-fade-in {
  animation: fade-in 180ms ease-out forwards;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: replace dark cyberpunk tokens with Apple light-mode design system"
```

---

## Task 3: i18n locale files and initializer

**Files:**
- Create: `src/locales/zh/translation.json`
- Create: `src/locales/en/translation.json`
- Create: `src/lib/i18n.ts`

- [ ] **Step 1: Create `src/locales/zh/translation.json`**

```json
{
  "nav": {
    "home": "总览",
    "install": "安装",
    "config": "配置",
    "tools": "工具",
    "gateway": "网关",
    "migrate": "迁移",
    "phase2Coming": "Phase 2 即将推出"
  },
  "home": {
    "installStatus": "安装状态",
    "currentVersion": "当前版本",
    "doctorResults": "诊断结果",
    "installed": "已安装",
    "notInstalled": "未安装",
    "running": "运行中",
    "notDetected": "未检测到",
    "detected": "已检测",
    "notRun": "未运行",
    "allPassed": "全部通过",
    "warnings": "项警告",
    "issues": "项问题",
    "systemDiagnosis": "系统诊断",
    "runDiagnosis": "运行诊断",
    "notInstalledHint": "Hermes 未安装。",
    "goInstall": "前往安装",
    "quickActions": "快速操作",
    "checkUpdate": "检查更新",
    "editConfig": "修改配置"
  },
  "install": {
    "selectMode": "选择安装模式",
    "mode": {
      "full": { "label": "完整安装", "desc": "包含消息网关、Cron、CLI 工具，约 180 MB（推荐）" },
      "core": { "label": "仅核心",   "desc": "最小安装，仅包含 CLI" },
      "voice": { "label": "含 Voice", "desc": "完整安装 + 语音转录模块" }
    },
    "recommended": "推荐",
    "progress": "安装进度",
    "done": "完成",
    "failed": "失败",
    "start": "开始安装",
    "reinstall": "重新安装",
    "uninstall": "卸载 Hermes",
    "uninstallConfirm": "确定要卸载 Hermes 吗？此操作不可撤销。"
  },
  "config": {
    "llmSection": "LLM 配置",
    "behaviorSection": "行为设置",
    "generalSection": "通用 / General",
    "providerLabel": "提供商",
    "modelLabel": "默认模型",
    "apiKeyLabel": "API Key",
    "showKey": "显示",
    "hideKey": "隐藏",
    "testConnection": "测试连接",
    "persistentMemory": "持久记忆",
    "persistentMemoryDesc": "跨会话保存用户偏好和项目上下文",
    "autoSkillGen": "自动生成技能",
    "autoSkillGenDesc": "从对话中自动提取可复用技能片段",
    "commandApproval": "命令审批模式",
    "commandApprovalDesc": "执行终端命令前需用户手动确认（更安全）",
    "budgetWarning": "预算压力提示",
    "budgetWarningDesc": "接近迭代上限时提醒 Agent 合并输出",
    "languageLabel": "语言 / Language",
    "saveAll": "保存所有配置",
    "providers": {
      "openrouter": "OpenRouter（推荐）",
      "google": "Google Gemini",
      "openai": "OpenAI",
      "anthropic": "Anthropic",
      "custom": "自定义端点"
    },
    "languages": {
      "system": "跟随系统 / Follow System",
      "zh": "中文",
      "en": "English"
    }
  },
  "toast": {
    "configSaved": "配置已保存",
    "saveFailed": "保存失败：",
    "configLoadFailed": "配置加载失败：",
    "connectionOk": "连接成功 ✓",
    "connectionFail": "连接失败，请检查 API Key",
    "testFailed": "测试失败：",
    "installSuccess": "安装成功！",
    "uninstallSuccess": "已卸载 Hermes",
    "uninstallFailed": "卸载失败：",
    "doctorFailed": "诊断失败："
  }
}
```

- [ ] **Step 2: Create `src/locales/en/translation.json`**

```json
{
  "nav": {
    "home": "Overview",
    "install": "Install",
    "config": "Config",
    "tools": "Tools",
    "gateway": "Gateway",
    "migrate": "Migrate",
    "phase2Coming": "Phase 2 coming soon"
  },
  "home": {
    "installStatus": "Install Status",
    "currentVersion": "Current Version",
    "doctorResults": "Doctor Results",
    "installed": "Installed",
    "notInstalled": "Not Installed",
    "running": "Running",
    "notDetected": "Not Detected",
    "detected": "Detected",
    "notRun": "Not Run",
    "allPassed": "All Passed",
    "warnings": "warnings",
    "issues": "issues",
    "systemDiagnosis": "System Diagnosis",
    "runDiagnosis": "Run Diagnosis",
    "notInstalledHint": "Hermes is not installed.",
    "goInstall": "Go to Install",
    "quickActions": "Quick Actions",
    "checkUpdate": "Check for Updates",
    "editConfig": "Edit Config"
  },
  "install": {
    "selectMode": "Select Install Mode",
    "mode": {
      "full": { "label": "Full Install", "desc": "Includes gateway, Cron, CLI tools (~180 MB, recommended)" },
      "core": { "label": "Core Only",    "desc": "Minimal install, CLI only" },
      "voice": { "label": "With Voice",  "desc": "Full install + voice transcription module" }
    },
    "recommended": "Recommended",
    "progress": "Install Progress",
    "done": "Done",
    "failed": "Failed",
    "start": "Start Install",
    "reinstall": "Reinstall",
    "uninstall": "Uninstall Hermes",
    "uninstallConfirm": "Are you sure you want to uninstall Hermes? This cannot be undone."
  },
  "config": {
    "llmSection": "LLM Config",
    "behaviorSection": "Behavior",
    "generalSection": "General",
    "providerLabel": "Provider",
    "modelLabel": "Default Model",
    "apiKeyLabel": "API Key",
    "showKey": "Show",
    "hideKey": "Hide",
    "testConnection": "Test Connection",
    "persistentMemory": "Persistent Memory",
    "persistentMemoryDesc": "Save user preferences and project context across sessions",
    "autoSkillGen": "Auto Skill Generation",
    "autoSkillGenDesc": "Automatically extract reusable skill snippets from conversations",
    "commandApproval": "Command Approval Mode",
    "commandApprovalDesc": "Require manual confirmation before running terminal commands",
    "budgetWarning": "Budget Pressure Alert",
    "budgetWarningDesc": "Remind the agent to consolidate output when nearing iteration limit",
    "languageLabel": "Language",
    "saveAll": "Save All Settings",
    "providers": {
      "openrouter": "OpenRouter (Recommended)",
      "google": "Google Gemini",
      "openai": "OpenAI",
      "anthropic": "Anthropic",
      "custom": "Custom Endpoint"
    },
    "languages": {
      "system": "Follow System",
      "zh": "中文",
      "en": "English"
    }
  },
  "toast": {
    "configSaved": "Settings saved",
    "saveFailed": "Save failed: ",
    "configLoadFailed": "Failed to load config: ",
    "connectionOk": "Connection successful ✓",
    "connectionFail": "Connection failed — check your API key",
    "testFailed": "Test failed: ",
    "installSuccess": "Installation complete!",
    "uninstallSuccess": "Hermes uninstalled",
    "uninstallFailed": "Uninstall failed: ",
    "doctorFailed": "Diagnosis failed: "
  }
}
```

- [ ] **Step 3: Create `src/lib/i18n.ts`**

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "../locales/zh/translation.json";
import en from "../locales/en/translation.json";

let initialized = false;

export function initI18n(): void {
  if (initialized) return;
  initialized = true;
  i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: "zh",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export { i18n };
```

- [ ] **Step 4: Commit**

```bash
git add src/locales/ src/lib/i18n.ts
git commit -m "feat: add zh/en translation files and i18next initializer"
```

---

## Task 4: Update TypeScript Tauri bindings

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add `language` field to `HermesConfig` and `getSystemLocale` to Commands**

Replace the entire `src/lib/tauri.ts` with:

```typescript
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, UnlistenFn } from "@tauri-apps/api/event";

// ── Domain types ──────────────────────────────────────────────

export interface PlatformInfo {
  os: "macos" | "windows" | "linux";
  arch: string;
  osVersion: string;
}

export interface HermesConfig {
  provider: string;
  model: string;
  backend: "local" | "docker" | "ssh" | "modal";
  memoryLimitMb: number;
  persistentMemory: boolean;
  autoSkillGeneration: boolean;
  commandApproval: boolean;
  budgetWarning: boolean;
  language: string; // "system" | "zh" | "en"
}

export interface DoctorResult {
  status: "ok" | "warn" | "fail";
  message: string;
}

export interface InstallProgress {
  line: string;
  pct: number;
}

export type InstallMode = "full" | "core" | "voice";

// ── Commands ──────────────────────────────────────────────────

export const Commands = {
  detectPlatform: (): Promise<PlatformInfo> =>
    tauriInvoke("detect_platform"),

  checkHermesVersion: (): Promise<string | null> =>
    tauriInvoke("check_hermes_version"),

  installHermes: (mode: InstallMode): Promise<void> =>
    tauriInvoke("install_hermes", { mode }),

  uninstallHermes: (): Promise<void> =>
    tauriInvoke("uninstall_hermes"),

  getConfig: (): Promise<HermesConfig> =>
    tauriInvoke("get_config"),

  saveConfig: (config: HermesConfig): Promise<void> =>
    tauriInvoke("save_config", { config }),

  saveApiKey: (key: string): Promise<void> =>
    tauriInvoke("save_api_key", { key }),

  testApiConnection: (provider: string, key: string): Promise<boolean> =>
    tauriInvoke("test_api_connection", { provider, key }),

  runDoctor: (): Promise<DoctorResult[]> =>
    tauriInvoke("run_doctor"),

  getRecentActivity: (): Promise<string[]> =>
    tauriInvoke("get_recent_activity"),

  getSystemLocale: (): Promise<string> =>
    tauriInvoke("get_system_locale"),
};

// ── Events ────────────────────────────────────────────────────

export const Events = {
  onInstallProgress: (
    handler: (progress: InstallProgress) => void
  ): Promise<UnlistenFn> =>
    tauriListen<InstallProgress>("install_progress", (e) => handler(e.payload)),

  onInstallDone: (handler: () => void): Promise<UnlistenFn> =>
    tauriListen("install_done", () => handler()),

  onInstallError: (handler: (msg: string) => void): Promise<UnlistenFn> =>
    tauriListen<string>("install_error", (e) => handler(e.payload)),
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only errors in files we haven't updated yet, which will be fixed in later tasks)

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: add language field to HermesConfig and getSystemLocale command binding"
```

---

## Task 5: Rust backend — language field and locale command

**Files:**
- Modify: `src-tauri/src/commands/config.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing Rust test first**

Add this test block to the bottom of `src-tauri/src/commands/config.rs` (inside the `#[cfg(test)] mod tests` block, after the existing tests):

```rust
    #[tokio::test]
    async fn test_get_system_locale_returns_nonempty() {
        let result = get_system_locale().await;
        assert!(result.is_ok());
        let locale = result.unwrap();
        assert!(!locale.is_empty(), "locale must not be empty");
    }

    #[test]
    fn test_config_roundtrip_with_language() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.yaml");
        let mut cfg = HermesConfig::default();
        cfg.language = "en".to_string();
        cfg.save_to(&path).unwrap();
        let loaded = HermesConfig::load_from(&path).unwrap();
        assert_eq!(loaded.language, "en");
    }
```

- [ ] **Step 2: Run tests — they should fail**

```bash
cd src-tauri && cargo test 2>&1 | grep -E "FAILED|error\[" | head -10
```

Expected: compilation error about `language` field not existing on `HermesConfig` and `get_system_locale` not found.

- [ ] **Step 3: Add `language` field and `get_system_locale` to `config.rs`**

Replace the contents of `src-tauri/src/commands/config.rs` with:

```rust
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

fn hermes_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".hermes")
}

fn config_path() -> PathBuf {
    hermes_dir().join("config.yaml")
}

fn env_path() -> PathBuf {
    hermes_dir().join(".env")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HermesConfig {
    #[serde(default = "default_provider")]
    pub provider: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_backend")]
    pub backend: String,
    #[serde(default = "default_memory_limit")]
    pub memory_limit_mb: u32,
    #[serde(default = "default_true")]
    pub persistent_memory: bool,
    #[serde(default = "default_true")]
    pub auto_skill_generation: bool,
    #[serde(default)]
    pub command_approval: bool,
    #[serde(default = "default_true")]
    pub budget_warning: bool,
    #[serde(default = "default_language")]
    pub language: String,
}

fn default_provider() -> String { "openrouter".into() }
fn default_model() -> String { "anthropic/claude-sonnet-4-5".into() }
fn default_backend() -> String { "local".into() }
fn default_memory_limit() -> u32 { 5120 }
fn default_true() -> bool { true }
fn default_language() -> String { "system".into() }

impl Default for HermesConfig {
    fn default() -> Self {
        Self {
            provider: default_provider(),
            model: default_model(),
            backend: default_backend(),
            memory_limit_mb: default_memory_limit(),
            persistent_memory: true,
            auto_skill_generation: true,
            command_approval: false,
            budget_warning: true,
            language: default_language(),
        }
    }
}

impl HermesConfig {
    pub fn load_from(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read config: {e}"))?;
        serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {e}"))
    }

    pub fn save_to(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config dir: {e}"))?;
        }
        let content = serde_yaml::to_string(self)
            .map_err(|e| format!("Failed to serialize config: {e}"))?;
        std::fs::write(path, content)
            .map_err(|e| format!("Failed to write config: {e}"))
    }
}

// ── Tauri commands ────────────────────────────────────────────

#[tauri::command]
pub async fn get_config() -> Result<HermesConfig, String> {
    HermesConfig::load_from(&config_path())
}

#[tauri::command]
pub async fn save_config(config: HermesConfig) -> Result<(), String> {
    config.save_to(&config_path())
}

#[tauri::command]
pub async fn save_api_key(key: String) -> Result<(), String> {
    let path = env_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .hermes dir: {e}"))?;
    }
    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    let mut lines: Vec<String> = existing
        .lines()
        .filter(|l| !l.starts_with("LLM_API_KEY="))
        .map(String::from)
        .collect();
    lines.push(format!("LLM_API_KEY={key}"));
    std::fs::write(&path, lines.join("\n") + "\n")
        .map_err(|e| format!("Failed to write .env: {e}"))
}

#[tauri::command]
pub async fn test_api_connection(provider: String, key: String) -> Result<bool, String> {
    let known_providers = ["openrouter", "openai", "anthropic", "google", "custom"];
    if key.is_empty() {
        return Err("API key is empty".into());
    }
    if !known_providers.contains(&provider.as_str()) {
        return Err(format!("Unknown provider: {provider}"));
    }
    Ok(key.len() > 8)
}

#[tauri::command]
pub async fn get_system_locale() -> Result<String, String> {
    // Check common Unix/macOS locale environment variables in priority order
    for var in &["LC_ALL", "LC_CTYPE", "LANG"] {
        if let Ok(val) = std::env::var(var) {
            if !val.is_empty() && val != "C" && val != "POSIX" {
                return Ok(val);
            }
        }
    }
    Ok("en-US".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_default_config_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.yaml");
        let cfg = HermesConfig::default();
        cfg.save_to(&path).unwrap();
        let loaded = HermesConfig::load_from(&path).unwrap();
        assert_eq!(loaded.provider, "openrouter");
        assert_eq!(loaded.persistent_memory, true);
        assert_eq!(loaded.language, "system");
    }

    #[test]
    fn test_load_nonexistent_returns_default() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("nonexistent.yaml");
        let cfg = HermesConfig::load_from(&path).unwrap();
        assert_eq!(cfg.provider, "openrouter");
        assert_eq!(cfg.language, "system");
    }

    #[test]
    fn test_save_api_key_writes_env() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        let key = "sk-test-1234567890".to_string();
        std::fs::write(&path, format!("LLM_API_KEY={key}\n")).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("LLM_API_KEY=sk-test-1234567890"));
    }

    #[test]
    fn test_config_roundtrip_with_language() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.yaml");
        let mut cfg = HermesConfig::default();
        cfg.language = "en".to_string();
        cfg.save_to(&path).unwrap();
        let loaded = HermesConfig::load_from(&path).unwrap();
        assert_eq!(loaded.language, "en");
    }

    #[tokio::test]
    async fn test_get_system_locale_returns_nonempty() {
        let result = get_system_locale().await;
        assert!(result.is_ok());
        let locale = result.unwrap();
        assert!(!locale.is_empty(), "locale must not be empty");
    }
}
```

- [ ] **Step 4: Register `get_system_locale` in `src-tauri/src/lib.rs`**

In `lib.rs`, add `config::get_system_locale,` to the `invoke_handler!` macro:

```rust
        .invoke_handler(tauri::generate_handler![
            installer::detect_platform,
            installer::check_hermes_version,
            installer::install_hermes,
            installer::uninstall_hermes,
            config::get_config,
            config::save_config,
            config::save_api_key,
            config::test_api_connection,
            config::get_system_locale,
            process::run_doctor,
            process::get_recent_activity,
        ])
```

- [ ] **Step 5: Run Rust tests and verify they pass**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1/src-tauri
cargo test 2>&1 | grep -E "test .* ok|FAILED|error"
```

Expected: all 10 tests pass (8 existing + 2 new), 0 FAILED

- [ ] **Step 6: Commit**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
git add src-tauri/src/commands/config.rs src-tauri/src/lib.rs
git commit -m "feat: add language field to HermesConfig and get_system_locale Rust command"
```

---

## Task 6: SegmentedControl, App.tsx, and Topbar.tsx

**Files:**
- Create: `src/components/layout/SegmentedControl.tsx`
- Replace: `src/components/layout/Topbar.tsx`
- Replace: `src/App.tsx`
- Delete: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `src/components/layout/SegmentedControl.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store";
import type { Panel } from "../../store";

interface Segment {
  id: Panel;
  labelKey: string;
  phase2?: boolean;
}

const SEGMENTS: Segment[] = [
  { id: "home",    labelKey: "nav.home" },
  { id: "install", labelKey: "nav.install" },
  { id: "config",  labelKey: "nav.config" },
  { id: "tools",   labelKey: "nav.tools",   phase2: true },
  { id: "gateway", labelKey: "nav.gateway", phase2: true },
  { id: "migrate", labelKey: "nav.migrate", phase2: true },
];

export function SegmentedControl() {
  const { activePanel, setActivePanel, showToast } = useUIStore();
  const { t } = useTranslation();

  function handleClick(seg: Segment) {
    if (seg.phase2) {
      showToast(t("nav.phase2Coming"), "info");
      return;
    }
    setActivePanel(seg.id);
  }

  return (
    <div className="flex bg-black/[0.06] rounded-[9px] p-[3px] gap-[2px]">
      {SEGMENTS.map((seg) => (
        <button
          key={seg.id}
          onClick={() => handleClick(seg)}
          className={`px-[14px] py-[5px] rounded-[7px] text-[13px] transition-all duration-150 ${
            activePanel === seg.id
              ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,.12)] font-[600] text-text-primary"
              : "font-[500] text-text-secondary hover:text-text-primary"
          }`}
        >
          {t(seg.labelKey)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/components/layout/Topbar.tsx`**

```tsx
export function Topbar() {
  return (
    <div className="flex items-center h-11 px-4 relative select-none">
      {/* Traffic lights */}
      <div className="flex items-center gap-[7px]">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
      </div>
      {/* App title centered */}
      <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-[600] text-text-primary">
        Hermes Manager
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/App.tsx`**

```tsx
import { useEffect } from "react";
import { Topbar } from "./components/layout/Topbar";
import { SegmentedControl } from "./components/layout/SegmentedControl";
import { Toast } from "./components/ui/Toast";
import { HomePanel } from "./components/panels/HomePanel";
import { InstallPanel } from "./components/panels/InstallPanel";
import { ConfigPanel } from "./components/panels/ConfigPanel";
import { useUIStore } from "./store";
import { initI18n } from "./lib/i18n";
import { i18n } from "./lib/i18n";
import { Commands } from "./lib/tauri";

initI18n();

function PlaceholderPanel() {
  return (
    <div className="flex items-center justify-center h-full text-text-tertiary text-[13px]">
      Phase 2 即将推出
    </div>
  );
}

export default function App() {
  const { activePanel } = useUIStore();

  // Detect and apply the user's configured language on startup
  useEffect(() => {
    async function applyLanguage() {
      try {
        const cfg = await Commands.getConfig();
        const lang = cfg.language ?? "system";
        if (lang === "system") {
          const locale = await Commands.getSystemLocale();
          await i18n.changeLanguage(locale.startsWith("zh") ? "zh" : "en");
        } else {
          await i18n.changeLanguage(lang);
        }
      } catch {
        // keep default zh on error
      }
    }
    applyLanguage();
  }, []);

  return (
    <div
      className="flex flex-col h-screen bg-bg-window overflow-hidden"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
    >
      {/* Title bar */}
      <div
        className="flex flex-col flex-shrink-0 bg-[rgba(246,246,246,.95)] border-b border-bg-secondary"
        style={{ backdropFilter: "blur(20px)" }}
      >
        <Topbar />
        <div className="flex justify-center pb-3">
          <SegmentedControl />
        </div>
      </div>

      {/* Panel content */}
      <main className="flex-1 overflow-y-auto p-5">
        {activePanel === "home"    && <HomePanel />}
        {activePanel === "install" && <InstallPanel />}
        {activePanel === "config"  && <ConfigPanel />}
        {(activePanel === "tools" || activePanel === "gateway" || activePanel === "migrate") && (
          <PlaceholderPanel />
        )}
      </main>

      <Toast />
    </div>
  );
}
```

- [ ] **Step 4: Delete `src/components/layout/Sidebar.tsx`**

```bash
rm /Users/laputancnai/HermesHelper/.worktrees/feature/phase1/src/components/layout/Sidebar.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/SegmentedControl.tsx src/components/layout/Topbar.tsx src/App.tsx
git rm src/components/layout/Sidebar.tsx
git commit -m "feat: replace sidebar with Segmented Control in Apple-style title bar"
```

---

## Task 7: Replace Button.tsx and Badge.tsx

**Files:**
- Replace: `src/components/ui/Button.tsx`
- Replace: `src/components/ui/Badge.tsx`

- [ ] **Step 1: Replace `src/components/ui/Button.tsx`**

```tsx
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:   "bg-accent text-white hover:opacity-90",
  secondary: "bg-bg-window text-text-primary border border-bg-secondary hover:bg-bg-secondary",
  danger:    "bg-status-red-bg text-status-red border border-[#FFD0D0] hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  md: "px-4 py-[7px] text-[13px] font-[500]",
  sm: "px-3 py-[5px] text-[12px] font-[500]",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-[8px] transition-opacity duration-200
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? "..." : children}
    </button>
  );
}
```

- [ ] **Step 2: Replace `src/components/ui/Badge.tsx`**

Note: status names change from `"blue"/"grey"` to `"accent"/"neutral"`. Panels will be updated in later tasks.

```tsx
type BadgeStatus = "green" | "yellow" | "red" | "accent" | "neutral";

const badgeClasses: Record<BadgeStatus, string> = {
  green:   "bg-status-green-bg  text-status-green",
  yellow:  "bg-status-yellow-bg text-status-yellow",
  red:     "bg-status-red-bg    text-status-red",
  accent:  "bg-accent-light     text-accent",
  neutral: "bg-bg-secondary     text-text-tertiary",
};

interface BadgeProps {
  status: BadgeStatus;
  children: React.ReactNode;
}

export function Badge({ status, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-[9px] py-[3px] rounded-[20px] text-[11px] font-[600] ${badgeClasses[status]}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Badge.tsx
git commit -m "style: rewrite Button and Badge with Apple light-mode styling"
```

---

## Task 8: Replace Toggle.tsx, LogLine.tsx, and Toast.tsx

**Files:**
- Replace: `src/components/ui/Toggle.tsx`
- Replace: `src/components/ui/LogLine.tsx`
- Replace: `src/components/ui/Toast.tsx`

- [ ] **Step 1: Replace `src/components/ui/Toggle.tsx`**

```tsx
interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <div>
        <span className="text-text-primary text-[13px]">{label}</span>
        {description && (
          <p className="text-text-placeholder text-[11px] mt-[2px]">{description}</p>
        )}
      </div>
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {/* Track */}
        <div
          className={`w-[51px] h-[31px] rounded-[16px] transition-colors duration-200 ${
            checked ? "bg-accent" : "bg-bg-secondary"
          } ${disabled ? "opacity-40" : ""}`}
        >
          {/* Thumb */}
          <div
            className={`absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,.2)] ${
              checked ? "right-[2px]" : "left-[2px]"
            }`}
          />
        </div>
      </div>
    </label>
  );
}
```

- [ ] **Step 2: Replace `src/components/ui/LogLine.tsx`**

```tsx
type LogStatus = "ok" | "warn" | "fail" | "info" | "muted";

const prefixMap: Record<LogStatus, string> = {
  ok:   "✅",
  warn: "⚠️",
  fail: "❌",
  info: "→",
  muted: "",
};

interface LogLineProps {
  status: LogStatus;
  message: string;
  /** Show Apple-style row background (default true). Pass false for plain inline log text. */
  bg?: boolean;
}

export function LogLine({ status, message, bg = true }: LogLineProps) {
  const bgClass = bg
    ? status === "warn"
      ? "bg-status-yellow-bg rounded-[8px]"
      : "bg-bg-window rounded-[8px]"
    : "";
  const textClass =
    status === "info"  ? "text-accent" :
    status === "muted" ? "text-text-tertiary" :
    "text-text-primary";

  return (
    <div className={`flex items-center gap-2 px-3 py-[6px] text-[12px] font-mono ${bgClass} ${textClass}`}>
      {prefixMap[status] && <span>{prefixMap[status]}</span>}
      <span>{message}</span>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/components/ui/Toast.tsx`**

```tsx
import { useEffect } from "react";
import { useUIStore } from "../../store";

export function Toast() {
  const { toast, clearToast } = useUIStore();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, toast.type === "error" ? 5000 : 2800);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const sidebarColor =
    toast.type === "success" ? "bg-status-green" :
    toast.type === "error"   ? "bg-status-red" :
    "bg-accent";

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-fade-in
      flex items-stretch bg-white rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,.12)] overflow-hidden">
      <div className={`w-[3px] ${sidebarColor}`} />
      <div className="px-4 py-[10px] text-[13px] text-text-primary">
        {toast.message}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Toggle.tsx src/components/ui/LogLine.tsx src/components/ui/Toast.tsx
git commit -m "style: rewrite Toggle (iOS 51x31), LogLine (emoji rows), and Toast (color-bar style)"
```

---

## Task 9: Replace HomePanel.tsx

**Files:**
- Replace: `src/components/panels/HomePanel.tsx`

- [ ] **Step 1: Replace `src/components/panels/HomePanel.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands } from "../../lib/tauri";
import { useHermesStore, useUIStore } from "../../store";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { LogLine } from "../ui/LogLine";

export function HomePanel() {
  const { t } = useTranslation();
  const {
    isInstalled, version, doctorResults, doctorRunning,
    setDoctorResults, setDoctorRunning, setInstalled,
  } = useHermesStore();
  const { showToast, setActivePanel } = useUIStore();
  const [hasRunDoctor, setHasRunDoctor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Commands.checkHermesVersion()
      .then((v) => {
        if (!cancelled) {
          const ver = typeof v === "string" ? v : null;
          setInstalled(!!ver, ver);
        }
      })
      .catch(() => { if (!cancelled) setInstalled(false, null); });
    return () => { cancelled = true; };
  }, [setInstalled]);

  async function handleRunDoctor() {
    setDoctorRunning(true);
    setHasRunDoctor(true);
    try {
      const results = await Commands.runDoctor();
      setDoctorResults(results);
    } catch (e) {
      showToast(t("toast.doctorFailed") + String(e), "error");
    } finally {
      setDoctorRunning(false);
    }
  }

  const passCount = doctorResults.filter((r) => r.status === "ok").length;
  const warnCount = doctorResults.filter((r) => r.status === "warn").length;
  const failCount = doctorResults.filter((r) => r.status === "fail").length;

  function doctorBadge() {
    if (!hasRunDoctor) return <Badge status="neutral">{t("home.notRun")}</Badge>;
    if (failCount > 0) return <Badge status="red">{warnCount + failCount} {t("home.issues")}</Badge>;
    if (warnCount > 0) return <Badge status="yellow">{warnCount} {t("home.warnings")}</Badge>;
    return <Badge status="green">{t("home.allPassed")}</Badge>;
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Status cards */}
      <div className="grid grid-cols-3 gap-[10px]">
        {/* Install status card */}
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-[6px]">
            {t("home.installStatus")}
          </div>
          <div className="text-[18px] font-[700] text-text-primary leading-none mb-[6px]">
            {isInstalled ? t("home.installed") : t("home.notInstalled")}
          </div>
          <Badge status={isInstalled ? "green" : "neutral"}>
            {isInstalled ? t("home.running") : t("home.notDetected")}
          </Badge>
        </div>

        {/* Version card */}
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-[6px]">
            {t("home.currentVersion")}
          </div>
          <div className="text-[18px] font-[700] text-text-primary leading-none mb-[6px]">
            {version ?? "—"}
          </div>
          {version
            ? <Badge status="accent">{t("home.detected")}</Badge>
            : <Badge status="neutral">{t("home.notDetected")}</Badge>
          }
        </div>

        {/* Doctor results card */}
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-[6px]">
            {t("home.doctorResults")}
          </div>
          <div className="text-[18px] font-[700] text-text-primary leading-none mb-[6px]">
            {hasRunDoctor ? `${passCount}✓ ${warnCount}⚠` : "—"}
          </div>
          {doctorBadge()}
        </div>
      </div>

      {/* System diagnosis card */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-[600] text-text-primary">
            {t("home.systemDiagnosis")}
          </span>
          <Button variant="primary" size="sm" onClick={handleRunDoctor} loading={doctorRunning}>
            {t("home.runDiagnosis")}
          </Button>
        </div>

        <div className="space-y-[4px]">
          {doctorResults.map((r, i) => (
            <LogLine
              key={i}
              status={r.status === "ok" ? "ok" : r.status === "warn" ? "warn" : "fail"}
              message={r.message}
            />
          ))}
        </div>

        {!isInstalled && !doctorRunning && doctorResults.length === 0 && (
          <p className="text-text-secondary text-[12px] mt-2">
            {t("home.notInstalledHint")}{" "}
            <button className="text-accent underline" onClick={() => setActivePanel("install")}>
              {t("home.goInstall")}
            </button>
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
          {t("home.quickActions")}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setActivePanel("install")}>
            {t("home.checkUpdate")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setActivePanel("config")}>
            {t("home.editConfig")}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/HomePanel.tsx
git commit -m "feat: rewrite HomePanel with Apple card-grid layout and i18n"
```

---

## Task 10: Replace InstallPanel.tsx

**Files:**
- Replace: `src/components/panels/InstallPanel.tsx`

- [ ] **Step 1: Replace `src/components/panels/InstallPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands, Events, InstallMode, InstallProgress } from "../../lib/tauri";
import { useUIStore } from "../../store";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

type Phase = "idle" | "installing" | "done" | "error";

export function InstallPanel() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const [selectedMode, setSelectedMode] = useState<InstallMode>("full");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<InstallProgress[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const MODES: { id: InstallMode; labelKey: string; descKey: string }[] = [
    { id: "full",  labelKey: "install.mode.full.label",  descKey: "install.mode.full.desc" },
    { id: "core",  labelKey: "install.mode.core.label",  descKey: "install.mode.core.desc" },
    { id: "voice", labelKey: "install.mode.voice.label", descKey: "install.mode.voice.desc" },
  ];

  useEffect(() => {
    const el = logRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo(0, el.scrollHeight);
    }
  }, [logs]);

  async function handleInstall() {
    setPhase("installing");
    setLogs([]);
    setProgress(0);

    const installPromise = Commands.installHermes(selectedMode);

    const [unlistenProgress, unlistenDone, unlistenError] = await Promise.all([
      Events.onInstallProgress((p) => {
        setLogs((prev) => [...prev, p]);
        setProgress(p.pct);
      }),
      Events.onInstallDone(() => {
        setPhase("done");
        setProgress(100);
        showToast(t("toast.installSuccess"), "success");
      }),
      Events.onInstallError((msg) => {
        setPhase("error");
        setErrorMsg(msg);
        showToast(msg, "error");
      }),
    ]);

    try {
      await installPromise;
    } catch (e) {
      setPhase("error");
      setErrorMsg(String(e));
    } finally {
      unlistenProgress();
      unlistenDone();
      unlistenError();
    }
  }

  async function handleUninstall() {
    if (!confirm(t("install.uninstallConfirm"))) return;
    try {
      await Commands.uninstallHermes();
      showToast(t("toast.uninstallSuccess"), "success");
    } catch (e) {
      showToast(t("toast.uninstallFailed") + String(e), "error");
    }
  }

  const progressBadgeStatus =
    phase === "done" ? "green" : phase === "error" ? "red" : "accent";
  const progressBadgeText =
    phase === "done" ? t("install.done") :
    phase === "error" ? t("install.failed") :
    `${progress}%`;

  return (
    <div className="space-y-3 max-w-2xl">
      {/* Mode selection card */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
          {t("install.selectMode")}
        </div>
        <div className="space-y-2">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex items-start gap-3 p-3 rounded-[10px] border cursor-pointer transition-colors duration-150 ${
                selectedMode === m.id
                  ? "bg-accent-light border-accent border-[1.5px]"
                  : "bg-white border-bg-secondary hover:bg-bg-window"
              }`}
            >
              {/* Custom radio button */}
              <div className="mt-[2px] flex-shrink-0">
                <input
                  type="radio"
                  name="mode"
                  value={m.id}
                  checked={selectedMode === m.id}
                  onChange={() => setSelectedMode(m.id)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === m.id
                      ? "border-accent bg-accent"
                      : "border-bg-secondary bg-white"
                  }`}
                >
                  {selectedMode === m.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-text-primary text-[13px] font-[500]">
                    {t(m.labelKey)}
                  </span>
                  {m.id === "full" && (
                    <Badge status="accent">{t("install.recommended")}</Badge>
                  )}
                </div>
                <p className="text-text-secondary text-[11px] mt-[3px]">{t(m.descKey)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Progress card — only shown during/after install */}
      {(phase === "installing" || phase === "done" || phase === "error") && (
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-[600] text-text-primary">
              {t("install.progress")}
            </span>
            <Badge status={progressBadgeStatus}>{progressBadgeText}</Badge>
          </div>
          {/* Gradient progress bar */}
          <div className="h-[6px] bg-bg-secondary rounded-[3px] overflow-hidden mb-3">
            <div
              className={`h-full rounded-[3px] transition-all duration-300 ${
                phase === "error"
                  ? "bg-status-red"
                  : "bg-gradient-to-r from-accent to-[#4ECDE4]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Log scroll area */}
          <div
            ref={logRef}
            className="max-h-[160px] overflow-y-auto space-y-[2px] font-mono text-[12px] text-text-secondary"
          >
            {logs.map((l, i) => (
              <div key={i}>{l.line}</div>
            ))}
            {phase === "error" && (
              <div className="text-status-red">❌ {errorMsg}</div>
            )}
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between">
        <Button
          variant="primary"
          onClick={handleInstall}
          disabled={phase === "installing"}
          loading={phase === "installing"}
        >
          {phase === "done" ? t("install.reinstall") : t("install.start")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleUninstall}
          disabled={phase === "installing"}
        >
          {t("install.uninstall")}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/InstallPanel.tsx
git commit -m "feat: rewrite InstallPanel with Apple radio-selection and gradient progress bar"
```

---

## Task 11: Replace ConfigPanel.tsx

**Files:**
- Replace: `src/components/panels/ConfigPanel.tsx`

- [ ] **Step 1: Replace `src/components/panels/ConfigPanel.tsx`**

```tsx
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

export function ConfigPanel() {
  const { t, i18n } = useTranslation();
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
      .catch((e) => showToast(t("toast.configLoadFailed") + String(e), "error"));
  }, [setConfig, showToast, t]);

  function update<K extends keyof HermesConfig>(key: K, value: HermesConfig[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLanguageChange(lang: string) {
    update("language", lang);
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
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Commands.saveConfig(local);
      if (apiKey) await Commands.saveApiKey(apiKey);
      setConfig(local);
      showToast(t("toast.configSaved"), "success");
    } catch (e) {
      showToast(t("toast.saveFailed") + String(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const ok = await Commands.testApiConnection(local.provider, apiKey);
      showToast(ok ? t("toast.connectionOk") : t("toast.connectionFail"), ok ? "success" : "error");
    } catch (e) {
      showToast(t("toast.testFailed") + String(e), "error");
    } finally {
      setTesting(false);
    }
  }

  const inputClass =
    "w-full bg-bg-window border border-bg-secondary rounded-[8px] px-3 py-2 text-[13px] text-text-primary " +
    "focus:outline-none focus:border-[1.5px] focus:border-accent";
  const labelClass = "block text-[12px] text-text-secondary font-[500] mb-[5px]";

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        {/* LLM config card */}
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)] space-y-3">
          <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase">
            {t("config.llmSection")}
          </div>

          <div>
            <label className={labelClass}>{t("config.providerLabel")}</label>
            <select
              value={local.provider}
              onChange={(e) => update("provider", e.target.value)}
              className={inputClass}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t("config.modelLabel")}</label>
            <select
              value={local.model}
              onChange={(e) => update("model", e.target.value)}
              className={inputClass}
            >
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t("config.apiKeyLabel")}</label>
            <div className="flex gap-2 mb-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className={`${inputClass} flex-1 font-mono`}
              />
              <Button size="sm" variant="secondary" onClick={() => setShowKey((v) => !v)}>
                {showKey ? t("config.hideKey") : t("config.showKey")}
              </Button>
            </div>
            <Button
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
          <label className={labelClass}>{t("config.languageLabel")}</label>
          <select
            value={local.language ?? "system"}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className={inputClass}
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Save button */}
      <Button
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/ConfigPanel.tsx
git commit -m "feat: rewrite ConfigPanel with 2-col card layout, language selector, and i18n"
```

---

## Task 12: Update tests

**Files:**
- Modify: `src/__tests__/setup.ts`
- Modify: `src/__tests__/panels/HomePanel.test.tsx`
- Modify: `src/__tests__/panels/InstallPanel.test.tsx`
- Modify: `src/__tests__/panels/ConfigPanel.test.tsx`
- Modify: `src/__tests__/ui/Toggle.test.tsx`

- [ ] **Step 1: Update `src/__tests__/setup.ts` to mock react-i18next**

```typescript
import "@testing-library/jest-dom/vitest";

// Mock @tauri-apps/api so tests don't need a real Tauri process
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock react-i18next — t(key) returns key so tests can assert on translation keys
vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn().mockResolvedValue(undefined), language: "zh" },
  })),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

// Mock src/lib/i18n to prevent real i18next initialization in tests
vi.mock("../lib/i18n", () => ({
  initI18n: vi.fn(),
  i18n: { changeLanguage: vi.fn().mockResolvedValue(undefined) },
}));
```

- [ ] **Step 2: Update `src/__tests__/panels/HomePanel.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { HomePanel } from "../../components/panels/HomePanel";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockInvoke.mockResolvedValue([]);
});

describe("HomePanel", () => {
  it("renders status card labels", () => {
    render(<HomePanel />);
    expect(screen.getByText("home.installStatus")).toBeInTheDocument();
    expect(screen.getByText("home.currentVersion")).toBeInTheDocument();
    expect(screen.getByText("home.doctorResults")).toBeInTheDocument();
  });

  it("shows run diagnosis button", () => {
    render(<HomePanel />);
    expect(screen.getByText("home.runDiagnosis")).toBeInTheDocument();
  });

  it("calls run_doctor when diagnosis button clicked", async () => {
    mockInvoke.mockResolvedValueOnce([
      { status: "ok", message: "hermes command available" },
    ]);
    render(<HomePanel />);
    fireEvent.click(screen.getByText("home.runDiagnosis"));
    expect(mockInvoke).toHaveBeenCalledWith("run_doctor");
  });
});
```

- [ ] **Step 3: Update `src/__tests__/panels/InstallPanel.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { InstallPanel } from "../../components/panels/InstallPanel";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;
const mockListen = listen as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockInvoke.mockResolvedValue({ os: "macos", arch: "arm64", osVersion: "14.4" });
  mockListen.mockResolvedValue(() => {});
});

describe("InstallPanel", () => {
  it("renders mode selection section", () => {
    render(<InstallPanel />);
    expect(screen.getByText("install.selectMode")).toBeInTheDocument();
  });

  it("shows all three install mode options", () => {
    render(<InstallPanel />);
    expect(screen.getByText("install.mode.full.label")).toBeInTheDocument();
    expect(screen.getByText("install.mode.core.label")).toBeInTheDocument();
    expect(screen.getByText("install.mode.voice.label")).toBeInTheDocument();
  });

  it("start button is enabled when a mode is selected", () => {
    render(<InstallPanel />);
    expect(screen.getByText("install.start")).not.toBeDisabled();
  });

  it("calls install_hermes with selected mode on start", async () => {
    render(<InstallPanel />);
    fireEvent.click(screen.getByText("install.start"));
    expect(mockInvoke).toHaveBeenCalledWith("install_hermes", { mode: "full" });
  });
});
```

- [ ] **Step 4: Update `src/__tests__/panels/ConfigPanel.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfigPanel } from "../../components/panels/ConfigPanel";
import { invoke } from "@tauri-apps/api/core";
import * as reactI18next from "react-i18next";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

const defaultConfig = {
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4-5",
  backend: "local",
  memoryLimitMb: 5120,
  persistentMemory: true,
  autoSkillGeneration: true,
  commandApproval: false,
  budgetWarning: true,
  language: "system",
};

beforeEach(() => {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_config") return Promise.resolve(defaultConfig);
    if (cmd === "get_system_locale") return Promise.resolve("zh-Hans-CN");
    return Promise.resolve();
  });
});

describe("ConfigPanel", () => {
  it("loads config on mount", async () => {
    render(<ConfigPanel />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("get_config"));
  });

  it("shows save button", async () => {
    render(<ConfigPanel />);
    await waitFor(() =>
      expect(screen.getByText("config.saveAll")).toBeInTheDocument()
    );
  });

  it("calls save_config on save click", async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText("config.saveAll"));
    fireEvent.click(screen.getByText("config.saveAll"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("save_config", expect.any(Object))
    );
  });

  it("renders language selector with system/zh/en options", async () => {
    render(<ConfigPanel />);
    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const langSelect = selects.find((s) =>
        Array.from(s.querySelectorAll("option")).some((o) => (o as HTMLOptionElement).value === "system")
      );
      expect(langSelect).toBeDefined();
    });
  });

  it("calls i18n.changeLanguage when language selector changes to 'zh'", async () => {
    const mockChangeLanguage = vi.fn().mockResolvedValue(undefined);
    vi.mocked(reactI18next.useTranslation).mockImplementation(() => ({
      t: (key: string) => key,
      i18n: { changeLanguage: mockChangeLanguage, language: "zh" },
    }));

    render(<ConfigPanel />);
    await waitFor(() => screen.getByText("config.saveAll"));

    const selects = screen.getAllByRole("combobox");
    const langSelect = selects.find((s) =>
      Array.from(s.querySelectorAll("option")).some(
        (o) => (o as HTMLOptionElement).value === "system"
      )
    ) as HTMLSelectElement;

    fireEvent.change(langSelect, { target: { value: "zh" } });
    await waitFor(() => expect(mockChangeLanguage).toHaveBeenCalledWith("zh"));
  });
});
```

- [ ] **Step 5: Update `src/__tests__/ui/Toggle.test.tsx`**

Add an assertion for the iOS-style track when checked:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "../../components/ui/Toggle";

describe("Toggle", () => {
  it("renders label", () => {
    render(<Toggle label="Persistent Memory" checked={false} onChange={() => {}} />);
    expect(screen.getByText("Persistent Memory")).toBeInTheDocument();
  });

  it("calls onChange when clicked", async () => {
    const onChange = vi.fn();
    render(<Toggle label="Test" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows checked state", () => {
    render(<Toggle label="Test" checked={true} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("applies accent track color when checked (iOS style)", () => {
    const { container } = render(
      <Toggle label="iOS Toggle" checked={true} onChange={() => {}} />
    );
    // The track div should have bg-accent class when checked
    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
  });

  it("applies secondary track color when unchecked", () => {
    const { container } = render(
      <Toggle label="iOS Toggle" checked={false} onChange={() => {}} />
    );
    expect(container.querySelector(".bg-bg-secondary")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the full test suite**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npm test -- --run 2>&1 | tail -20
```

Expected: all 15+ tests pass, 0 failures

- [ ] **Step 7: Commit**

```bash
git add src/__tests__/
git commit -m "test: update all tests for i18n keys and new Apple-style component assertions"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `npm test -- --run` passes all tests
- [ ] `cd src-tauri && cargo test` passes all Rust tests
- [ ] `npm run build` succeeds (TypeScript + Vite build)
- [ ] No references to old dark-theme CSS classes (`bg-bg-0`, `text-text-0`, `bg-cyan`, `font-ui`, `font-mono`) remain in non-deleted files: `grep -r "bg-bg-0\|bg-bg-1\|bg-bg-2\|bg-cyan\|font-ui" src/components/`
- [ ] `Sidebar.tsx` is deleted: `ls src/components/layout/Sidebar.tsx 2>&1` should say "No such file"
- [ ] Translation keys are used consistently: every hardcoded Chinese/English UI string has been replaced with `t("...")`
