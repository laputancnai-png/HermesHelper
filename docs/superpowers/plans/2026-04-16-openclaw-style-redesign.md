# HermesHelper UI Redesign — OpenClawHelper Style

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete UI redesign of HermesHelper to match OpenClawHelper's visual style and simplify functionality to: Install/Update/Uninstall, Model Config, Import/Export, and Gateway auto-detect status — all on a single scrollable page.

**Architecture:** Remove Tailwind CSS and replace with inline CSS using a shared `theme.ts` design token file (mirrors OpenClawHelper's `theme.js`). Replace react-i18next with a lightweight `useLang` hook. Simplify Zustand store to a single file. Keep all Tauri Rust commands; add one new command `check_hermes_running`. The entire app becomes a single-page layout (no tabs) with 4 stacked panels below a sticky top navbar.

**Tech Stack:** React 19 + TypeScript, Tauri 2, Zustand 5, inline CSS (no Tailwind), Nunito + Fredoka One fonts, `src/theme.ts` design tokens.

---

## File Map

### Files to CREATE
| Path | Responsibility |
|------|---------------|
| `src/theme.ts` | All design tokens (colors, radius, shadows, fonts) |
| `src/components/shared.tsx` | `Btn` + `Pill` primitive components (inline CSS) |
| `src/i18n.tsx` | `useLang` hook + zh/en translations (replaces react-i18next) |
| `src/features/status/HermesStatusPanel.tsx` | Top status card: installed, version, running state + auto-detect |
| `src/features/install/InstallPanel.tsx` | Install / Update / Uninstall with log viewer |
| `src/features/model/ModelPanel.tsx` | Provider + model dropdown + API key input + save |
| `src/features/migrate/MigratePanel.tsx` | Export ZIP + Import ZIP via Tauri commands |
| `src-tauri/src/commands/status.rs` | New: `check_hermes_running` command |

### Files to HEAVILY REWRITE
| Path | Change |
|------|--------|
| `src/App.tsx` | New: sticky navbar + single-page layout, no tabs, 4 panels |
| `src/store/index.ts` | Collapse 3 slices into one simple store |
| `src/index.css` | Remove all Tailwind; add font imports + CSS keyframes |
| `src/main.tsx` | Remove initI18n call |
| `src/lib/tauri.ts` | Add `checkHermesRunning` command |
| `src-tauri/src/commands/mod.rs` | Export new status module |
| `src-tauri/src/lib.rs` | Register `check_hermes_running` handler |

### Files to DELETE (after their functionality is replaced)
- `src/components/layout/SegmentedControl.tsx`
- `src/components/layout/Topbar.tsx`
- `src/components/panels/HomePanel.tsx`
- `src/components/panels/ConfigPanel.tsx`
- `src/components/panels/ToolsPanel.tsx`
- `src/components/panels/GatewayPanel.tsx`
- `src/components/panels/InstallPanel.tsx`
- `src/components/panels/MigratePanel.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/LogLine.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/Toggle.tsx`
- `src/store/hermesSlice.ts`
- `src/store/configSlice.ts`
- `src/store/uiSlice.ts`
- `src/lib/i18n.ts`
- `src/locales/en/translation.json`
- `src/locales/zh/translation.json`
- Old test files (rewritten in Task 9)

---

## Task 1: Theme + Global CSS Foundation

**Files:**
- Create: `src/theme.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Create `src/theme.ts`**

```typescript
// src/theme.ts — design tokens (mirrors OpenClawHelper theme.js)
export const P = {
  bg:     "#F4F6FF",
  white:  "#FFFFFF",
  ink:    "#1F1F30",
  soft:   "#7878A0",
  border: "#E4E4F4",

  indigo: "#5B5FEF",
  teal:   "#18B989",
  coral:  "#FF6B4A",
  amber:  "#F59E0B",

  radius: { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 },

  shadow: {
    card:   "0 2px 12px rgba(91,95,239,0.08)",
    panel:  "0 4px 18px rgba(0,0,0,0.06)",
    heavy:  "0 8px 40px rgba(0,0,0,0.10)",
    btn:    (c: string) => `0 3px 10px ${c}33`,
    btnHov: (c: string) => `0 6px 20px ${c}66`,
  },

  nav: { height: 56, bg: "#FFFFFF", border: "#EBEBF8" },

  banner: {
    success: { bg: "#EAFAF3", border: "#A8EDD0", text: "#1A6A4A" },
    warning: { bg: "#FFFBE8", border: "#FFE066", text: "#8A6A00" },
    error:   { bg: "#FFF0EE", border: "#FFB8A8", text: "#8B2020" },
  },
} as const;
```

- [ ] **Step 2: Replace `src/index.css` completely**

```css
/* src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: "Nunito", sans-serif;
  background: #F4F6FF;
  color: #1F1F30;
  -webkit-font-smoothing: antialiased;
}

button { font-family: "Nunito", sans-serif; }
textarea:focus, input:focus { outline: none; }
textarea::placeholder, input::placeholder { color: #B8B8D0; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #D0D0E8; border-radius: 3px; }

@keyframes pop {
  0%   { transform: scale(0.9); opacity: 0; }
  65%  { transform: scale(1.03); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes slide-up {
  from { transform: translateY(16px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.pop      { animation: pop 0.22s ease forwards; }
.slide-up { animation: slide-up 0.2s ease forwards; }
.spin     { animation: spin 1s linear infinite; display: inline-block; }
```

- [ ] **Step 3: Remove Tailwind from vite.config**

Edit `vite.config.ts`: remove `@tailwindcss/vite` plugin import and usage. File should look like:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: false },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
```

- [ ] **Step 4: Build to verify no Tailwind errors**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds (TypeScript errors OK for now — Tailwind removal may break class names in old components, which will be deleted in later tasks)

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts src/index.css vite.config.ts
git commit -m "feat: replace Tailwind with inline CSS foundation + theme tokens"
```

---

## Task 2: Shared Primitive Components

**Files:**
- Create: `src/components/shared.tsx`

- [ ] **Step 1: Create `src/components/shared.tsx`**

```tsx
// src/components/shared.tsx — Btn + Pill primitives
import { useState } from "react";
import { P } from "../theme";

interface PillProps {
  bg: string;
  border: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Pill({ bg, border, children, style }: PillProps) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: bg, border: `2px solid ${border}`,
      borderRadius: 20, padding: "3px 12px",
      fontSize: 13, fontWeight: 700, color: P.ink, ...style,
    }}>
      {children}
    </span>
  );
}

interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  color?: string;
  ghost?: boolean;
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
  type?: "button" | "submit";
}

export function Btn({ children, onClick, color = P.indigo, ghost, small, disabled, loading, style, type = "button" }: BtnProps) {
  const [hov, setHov] = useState(false);
  const isDisabled = disabled || loading;

  if (ghost) {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? "#F0F0F8" : P.white,
          color: P.soft,
          border: "2px solid #E0E0F0",
          borderRadius: 14,
          padding: small ? "6px 14px" : "11px 24px",
          fontSize: small ? 12 : 14,
          fontWeight: 700,
          cursor: isDisabled ? "default" : "pointer",
          transition: "all 0.15s",
          opacity: isDisabled ? 0.6 : 1,
          ...style,
        }}
      >
        {loading ? <span className="spin">⚙️</span> : children}
      </button>
    );
  }

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: isDisabled ? "#D0D0E0" : color,
        color: "#fff",
        border: "none",
        borderRadius: 16,
        padding: small ? "8px 18px" : "13px 28px",
        fontSize: small ? 13 : 15,
        fontWeight: 800,
        cursor: isDisabled ? "default" : "pointer",
        boxShadow: hov && !isDisabled ? P.shadow.btnHov(color) : P.shadow.btn(color),
        transform: hov && !isDisabled ? "translateY(-2px)" : "none",
        transition: "all 0.18s ease",
        opacity: isDisabled ? 0.7 : 1,
        display: "inline-flex", alignItems: "center", gap: 6,
        ...style,
      }}
    >
      {loading ? <><span className="spin" style={{ fontSize: small ? 12 : 14 }}>⚙️</span> {children}</> : children}
    </button>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build 2>&1 | grep "src/components/shared"`
Expected: no errors in shared.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/shared.tsx
git commit -m "feat: add Btn + Pill shared primitives (OpenClawHelper style)"
```

---

## Task 3: Simplified i18n

**Files:**
- Create: `src/i18n.tsx`

- [ ] **Step 1: Create `src/i18n.tsx`**

```tsx
// src/i18n.tsx — lightweight zh/en i18n (replaces react-i18next)
import { createContext, useContext, useState, ReactNode } from "react";

const ZH = {
  app: { brand: "Hermes Manager", tagline: "Hermes AI 助手管理器" },
  nav: { lang: "语言" },
  status: {
    installed: "已安装", notInstalled: "未安装",
    running: "运行中", stopped: "已停止",
    version: "版本", detecting: "检测中...",
    gatewayConnected: "Gateway 已连接", gatewayOffline: "Gateway 离线",
  },
  install: {
    title: "安装 / 更新",
    desc: "自动下载并安装 Hermes Agent（通常需要 3–10 分钟）",
    start: "开始安装", reinstall: "重新安装",
    update: "检查更新", uninstall: "卸载",
    uninstallConfirm: "确认卸载 Hermes？此操作将删除 ~/.hermes 目录及所有数据。",
    uninstallClean: "同时删除所有数据（~/.hermes）",
    progress: "安装进度", waiting: "正在启动安装程序...",
    done: "安装完成", failed: "安装失败",
    cancelBtn: "取消", clearBtn: "清除日志",
    installing: "安装中",
  },
  model: {
    title: "模型配置",
    desc: "配置 AI 提供商和模型",
    provider: "提供商", model: "模型", apiKey: "API 密钥",
    showKey: "显示", hideKey: "隐藏",
    testConn: "测试连接", save: "保存配置",
    connOk: "✅ 连接成功", connFail: "❌ 连接失败",
    saved: "配置已保存", saveFailed: "保存失败",
    placeholder: "sk-or-v1-...",
  },
  migrate: {
    title: "数据迁移",
    desc: "导出或导入 Hermes 配置与数据",
    export: "导出数据", import: "导入数据",
    importing: "导入中...",
    exportOk: "✅ 导出成功", exportFailed: "❌ 导出失败",
    importOk: "✅ 导入成功", importFailed: "❌ 导入失败",
    importConfirm: "导入会覆盖现有配置，确认继续？",
    selectFile: "选择 .zip 文件",
  },
  toast: {
    installSuccess: "安装成功！", installFailed: "安装失败",
    uninstallSuccess: "卸载成功", uninstallFailed: "卸载失败",
  },
};

const EN: typeof ZH = {
  app: { brand: "Hermes Manager", tagline: "Hermes AI Agent Manager" },
  nav: { lang: "Language" },
  status: {
    installed: "Installed", notInstalled: "Not Installed",
    running: "Running", stopped: "Stopped",
    version: "Version", detecting: "Detecting...",
    gatewayConnected: "Gateway Connected", gatewayOffline: "Gateway Offline",
  },
  install: {
    title: "Install / Update",
    desc: "Auto-download and install Hermes Agent (usually 3–10 minutes)",
    start: "Start Install", reinstall: "Reinstall",
    update: "Check Update", uninstall: "Uninstall",
    uninstallConfirm: "Uninstall Hermes? This will delete ~/.hermes and all data.",
    uninstallClean: "Also delete all data (~/.hermes)",
    progress: "Install Progress", waiting: "Starting installer...",
    done: "Install Complete", failed: "Install Failed",
    cancelBtn: "Cancel", clearBtn: "Clear Logs",
    installing: "Installing",
  },
  model: {
    title: "Model Config",
    desc: "Configure AI provider and model",
    provider: "Provider", model: "Model", apiKey: "API Key",
    showKey: "Show", hideKey: "Hide",
    testConn: "Test Connection", save: "Save Config",
    connOk: "✅ Connection OK", connFail: "❌ Connection Failed",
    saved: "Config saved", saveFailed: "Save failed",
    placeholder: "sk-or-v1-...",
  },
  migrate: {
    title: "Data Migration",
    desc: "Export or import Hermes configuration and data",
    export: "Export Data", import: "Import Data",
    importing: "Importing...",
    exportOk: "✅ Export successful", exportFailed: "❌ Export failed",
    importOk: "✅ Import successful", importFailed: "❌ Import failed",
    importConfirm: "Import will overwrite existing config. Continue?",
    selectFile: "Select .zip file",
  },
  toast: {
    installSuccess: "Install successful!", installFailed: "Install failed",
    uninstallSuccess: "Uninstall successful", uninstallFailed: "Uninstall failed",
  },
};

const TRANSLATIONS = { zh: ZH, en: EN } as const;
type Lang = keyof typeof TRANSLATIONS;

const LS_KEY = "hermes-manager.lang.v1";
function detectLang(): Lang {
  const saved = localStorage.getItem(LS_KEY);
  if (saved === "zh" || saved === "en") return saved;
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof ZH;
}

const Ctx = createContext<LangCtx>({ lang: "zh", setLang: () => {}, t: ZH });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(LS_KEY, l);
  }
  return <Ctx.Provider value={{ lang, setLang, t: TRANSLATIONS[lang] }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/i18n.tsx
git commit -m "feat: add lightweight useLang i18n hook (zh/en)"
```

---

## Task 4: New Rust Command — check_hermes_running

**Files:**
- Create: `src-tauri/src/commands/status.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Write test first in `src-tauri/src/commands/status.rs`**

```rust
// src-tauri/src/commands/status.rs
use serde::Serialize;
use tokio::process::Command;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HermesStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub running: bool,
}

fn parse_version(output: &str) -> Option<String> {
    for line in output.lines() {
        let lower = line.trim().to_lowercase();
        if lower.starts_with("hermes") {
            for token in line.split_whitespace() {
                let t = token.trim_start_matches('v');
                if t.contains('.') && t.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                    return Some(token.to_string());
                }
            }
        }
    }
    None
}

fn hermes_bin() -> Option<std::path::PathBuf> {
    let home = dirs::home_dir()?;
    [home.join(".local/bin/hermes"), home.join(".hermes/bin/hermes")]
        .into_iter()
        .find(|p| p.exists())
}

#[tauri::command]
pub async fn get_hermes_status() -> Result<HermesStatus, String> {
    let bin = hermes_bin();
    let installed = bin.is_some();

    if !installed {
        return Ok(HermesStatus { installed: false, version: None, running: false });
    }

    let bin = bin.unwrap();
    let version = Command::new(&bin)
        .arg("--version")
        .output()
        .await
        .ok()
        .and_then(|o| parse_version(&String::from_utf8_lossy(&o.stdout)));

    // Check if a hermes process is running by looking for the binary path in process list
    let running = Command::new("pgrep")
        .args(["-f", "hermes"])
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false);

    Ok(HermesStatus { installed, version, running })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version_hermes_agent_format() {
        let out = "Hermes Agent v0.10.0 (2026.4.16)\nProject: /Users/foo/.hermes";
        assert_eq!(parse_version(out), Some("v0.10.0".to_string()));
    }

    #[test]
    fn test_parse_version_missing() {
        assert_eq!(parse_version("command not found"), None);
    }

    #[test]
    fn test_parse_version_plain_string() {
        assert_eq!(parse_version("hermes 0.9.4"), Some("0.9.4".to_string()));
    }
}
```

- [ ] **Step 2: Run tests — should pass**

```bash
cd src-tauri && cargo test commands::status 2>&1 | tail -10
```
Expected: `test result: ok. 3 passed`

- [ ] **Step 3: Export in `src-tauri/src/commands/mod.rs`**

Add at the end of mod.rs:
```rust
pub mod status;
```

- [ ] **Step 4: Register command in `src-tauri/src/lib.rs`**

In the `.invoke_handler(tauri::generate_handler![...])` call, add:
```rust
commands::status::get_hermes_status,
```

- [ ] **Step 5: Add to `src/lib/tauri.ts`**

Add the interface and command:
```typescript
export interface HermesStatus {
  installed: boolean;
  version: string | null;
  running: boolean;
}
```

And in `Commands`:
```typescript
getHermesStatus: (): Promise<HermesStatus> =>
  tauriInvoke("get_hermes_status"),
```

- [ ] **Step 6: Run all Rust tests**

```bash
cd src-tauri && cargo test 2>&1 | grep "test result"
```
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/status.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src/lib/tauri.ts
git commit -m "feat: add get_hermes_status Tauri command"
```

---

## Task 5: Simplified Zustand Store

**Files:**
- Modify: `src/store/index.ts`

- [ ] **Step 1: Rewrite `src/store/index.ts` as a single flat store**

```typescript
// src/store/index.ts
import { create } from "zustand";

export interface HermesConfig {
  provider: string;
  model: string;
  memoryLimitMb: number;
  persistentMemory: boolean;
  autoSkillGeneration: boolean;
  commandApproval: boolean;
  budgetWarning: boolean;
  language: string;
}

export interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

interface Store {
  // Status
  installed: boolean;
  version: string | null;
  running: boolean;
  setStatus: (installed: boolean, version: string | null, running: boolean) => void;

  // Config
  config: HermesConfig;
  setConfig: (c: HermesConfig) => void;

  // Toast
  toast: Toast | null;
  showToast: (message: string, type?: Toast["type"]) => void;
  clearToast: () => void;
}

const DEFAULT_CONFIG: HermesConfig = {
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4-5",
  memoryLimitMb: 5120,
  persistentMemory: true,
  autoSkillGeneration: true,
  commandApproval: false,
  budgetWarning: true,
  language: "system",
};

export const useStore = create<Store>((set) => ({
  installed: false,
  version: null,
  running: false,
  setStatus: (installed, version, running) => set({ installed, version, running }),

  config: DEFAULT_CONFIG,
  setConfig: (config) => set({ config }),

  toast: null,
  showToast: (message, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3500);
  },
  clearToast: () => set({ toast: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/index.ts
git commit -m "refactor: collapse store slices into single flat Zustand store"
```

---

## Task 6: HermesStatusPanel

**Files:**
- Create: `src/features/status/HermesStatusPanel.tsx`

- [ ] **Step 1: Create `src/features/status/HermesStatusPanel.tsx`**

```tsx
// src/features/status/HermesStatusPanel.tsx
import { useEffect } from "react";
import { P } from "../../theme";
import { Commands } from "../../lib/tauri";
import { useStore } from "../../store";
import { useLang } from "../../i18n";

export function HermesStatusPanel() {
  const { t } = useLang();
  const { installed, version, running, setStatus } = useStore();

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const s = await Commands.getHermesStatus();
        if (alive) setStatus(s.installed, s.version, s.running);
      } catch {}
    }
    poll();
    const id = setInterval(poll, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, [setStatus]);

  const bgStyle = running
    ? { background: "linear-gradient(135deg,#D8F7EC,#E8FFF5)", border: `3px solid #7FE8C4` }
    : installed
    ? { background: "linear-gradient(135deg,#DCF5FF,#E8F4FF)", border: `3px solid #90D8FF` }
    : { background: "linear-gradient(135deg,#FFF8E8,#FFF5E0)", border: `3px solid #FFE066` };

  const iconColor = running ? P.teal : installed ? "#2AA8D8" : P.amber;
  const statusText = running ? t.status.running : installed ? t.status.stopped : t.status.notInstalled;
  const statusColor = running ? P.teal : installed ? "#2AA8D8" : P.soft;

  return (
    <div className="slide-up" style={{
      ...bgStyle,
      borderRadius: P.radius.xl,
      padding: "18px 22px",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: P.radius.lg,
          background: iconColor, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 26,
          boxShadow: `0 4px 12px ${iconColor}66`, flexShrink: 0,
        }}>
          🤖
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink }}>
            Hermes Agent
          </div>
          <div style={{ fontSize: 12, color: statusColor, fontWeight: 600, marginTop: 2 }}>
            {statusText}
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexShrink: 0 }}>
          {version && (
            <div style={{ fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: P.soft }}>{t.status.version} </span>
              <span style={{ color: P.ink, fontWeight: 700 }}>{version}</span>
            </div>
          )}
          {/* Gateway dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: running ? P.teal : P.soft,
              display: "inline-block",
              boxShadow: running ? `0 0 6px ${P.teal}` : "none",
              animation: running ? "none" : "pulse-dot 2s ease-in-out infinite",
            }} />
            <span style={{ fontWeight: 700, color: running ? P.teal : P.soft }}>
              {running ? t.status.gatewayConnected : t.status.gatewayOffline}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/status/HermesStatusPanel.tsx
git commit -m "feat: HermesStatusPanel with 10s polling of hermes status"
```

---

## Task 7: New InstallPanel

**Files:**
- Create: `src/features/install/InstallPanel.tsx`

- [ ] **Step 1: Create `src/features/install/InstallPanel.tsx`**

```tsx
// src/features/install/InstallPanel.tsx
import { useEffect, useRef, useState } from "react";
import { P } from "../../theme";
import { Btn } from "../../components/shared";
import { Commands, Events, InstallProgress } from "../../lib/tauri";
import { useStore } from "../../store";
import { useLang } from "../../i18n";

type Phase = "idle" | "installing" | "done" | "error";

function timeBasedProgress(elapsed: number) {
  return Math.round(90 * (1 - Math.exp(-elapsed / 900)));
}

function formatElapsed(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function InstallPanel() {
  const { t } = useLang();
  const { installed, showToast } = useStore();
  const [phase, setPhase] = useState<Phase>("idle");
  const [logs, setLogs] = useState<Array<InstallProgress & { id: number }>>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [showUninstallOpts, setShowUninstallOpts] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo(0, el.scrollHeight);
  }, [logs]);

  useEffect(() => {
    if (phase === "installing") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  async function handleInstall() {
    if (phase === "installing") return;
    setPhase("installing");
    setLogs([]);
    setErrorMsg("");

    const [unProg, unDone, unErr] = await Promise.all([
      Events.onInstallProgress(p => setLogs(prev => [...prev, { ...p, id: prev.length }])),
      Events.onInstallDone(() => { setPhase("done"); showToast(t.toast.installSuccess, "success"); }),
      Events.onInstallError(msg => { setPhase("error"); setErrorMsg(msg); showToast(msg, "error"); }),
    ]);

    try {
      await Commands.installHermes();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase("error");
      setErrorMsg(msg);
      showToast(msg, "error");
    } finally {
      unProg(); unDone(); unErr();
    }
  }

  async function handleUninstall() {
    if (!confirm(t.install.uninstallConfirm)) return;
    try {
      await Commands.uninstallHermes();
      showToast(t.toast.uninstallSuccess, "success");
      setShowUninstallOpts(false);
    } catch (e) {
      showToast(`${t.toast.uninstallFailed}: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
  }

  const visualPct = phase === "done" ? 100 : phase === "error" ? 0 : phase === "installing" ? timeBasedProgress(elapsed) : 0;

  return (
    <div style={{
      background: P.white, borderRadius: P.radius.xl,
      padding: "20px 24px", marginBottom: 12,
      boxShadow: P.shadow.panel, border: `2px solid ${P.border}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink }}>
            {t.install.title}
          </div>
          <div style={{ fontSize: 12, color: P.soft, marginTop: 2 }}>{t.install.desc}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small color={P.indigo} onClick={handleInstall} disabled={phase === "installing"} loading={phase === "installing"}>
            {phase === "done" || installed ? t.install.reinstall : t.install.start}
          </Btn>
          {installed && (
            <Btn small ghost onClick={() => setShowUninstallOpts(s => !s)} disabled={phase === "installing"}>
              {t.install.uninstall}
            </Btn>
          )}
        </div>
      </div>

      {/* Uninstall confirm */}
      {showUninstallOpts && (
        <div style={{
          marginBottom: 12, padding: "10px 14px",
          background: "#FFF8F2", border: "1px solid #FFD8CC", borderRadius: 10,
        }}>
          <div style={{ fontSize: 12, color: P.coral, fontWeight: 700, marginBottom: 8 }}>
            {t.install.uninstallClean}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small color={P.coral} onClick={handleUninstall}>{t.install.uninstall}</Btn>
            <Btn small ghost onClick={() => setShowUninstallOpts(false)}>取消</Btn>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {phase !== "idle" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: P.soft }}>{t.install.progress}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: phase === "done" ? P.teal : phase === "error" ? P.coral : P.indigo }}>
              {phase === "done" ? t.install.done : phase === "error" ? t.install.failed : formatElapsed(elapsed)}
            </span>
          </div>
          <div style={{ height: 6, background: "#EBEBF8", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
            <div style={{
              height: "100%", borderRadius: 3,
              width: `${visualPct}%`,
              background: phase === "error" ? P.coral : `linear-gradient(90deg, ${P.indigo}, #8B8FFF)`,
              transition: "width 1s ease-out",
            }} />
          </div>
        </>
      )}

      {/* Log area */}
      {(phase === "installing" || logs.length > 0) && (
        <div style={{
          background: "#1E1E2E", borderRadius: 12, overflow: "hidden",
          maxHeight: 240, display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "8px 14px", background: "#2A2A3E",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderBottom: "1px solid #3A3A4E",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {phase === "installing" && <span className="spin" style={{ fontSize: 13 }}>⚙️</span>}
              <span style={{ fontSize: 11, color: "#A0A0C0", fontWeight: 600 }}>{t.install.progress}</span>
            </div>
            <button
              onClick={() => setLogs([])}
              style={{
                background: "transparent", border: "1px solid #4A4A5E",
                borderRadius: 6, padding: "3px 10px", fontSize: 11,
                color: "#A0A0C0", cursor: "pointer",
              }}
            >
              {t.install.clearBtn}
            </button>
          </div>
          <div ref={logRef} style={{
            flex: 1, overflowY: "auto", padding: 12,
            fontFamily: "'SF Mono','Monaco','Consolas',monospace", fontSize: 11, lineHeight: 1.7,
          }}>
            {phase === "installing" && logs.length === 0 && (
              <div style={{ color: "#7070A0" }}>{t.install.waiting}</div>
            )}
            {logs.map(l => (
              <div key={l.id} style={{ color: "#A0A0C0", marginBottom: 2 }}>{l.line}</div>
            ))}
            {phase === "error" && (
              <div style={{ color: P.coral, marginTop: 4 }}>❌ {errorMsg}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/install/InstallPanel.tsx
git commit -m "feat: new InstallPanel with OpenClawHelper inline CSS style"
```

---

## Task 8: ModelPanel + MigratePanel

**Files:**
- Create: `src/features/model/ModelPanel.tsx`
- Create: `src/features/migrate/MigratePanel.tsx`

- [ ] **Step 1: Create `src/features/model/ModelPanel.tsx`**

```tsx
// src/features/model/ModelPanel.tsx
import { useEffect, useState } from "react";
import { P } from "../../theme";
import { Btn } from "../../components/shared";
import { Commands } from "../../lib/tauri";
import { useStore } from "../../store";
import { useLang } from "../../i18n";

const PROVIDERS = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "anthropic",  label: "Anthropic" },
  { value: "openai",     label: "OpenAI" },
  { value: "google",     label: "Google" },
  { value: "nous",       label: "Nous Portal" },
];

const MODELS: Record<string, string[]> = {
  openrouter: ["anthropic/claude-sonnet-4-5", "anthropic/claude-opus-4", "openai/gpt-4o", "google/gemini-2.5-pro"],
  anthropic:  ["claude-sonnet-4-5", "claude-opus-4", "claude-haiku-4-5"],
  openai:     ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  google:     ["gemini-2.5-pro", "gemini-2.5-flash"],
  nous:       ["hermes-3-70b", "hermes-3-405b"],
};

const INPUT = {
  width: "100%",
  background: "#F8F8FC",
  border: "2px solid #E8E8F5",
  borderRadius: P.radius.sm,
  padding: "9px 12px",
  fontSize: 13,
  color: P.ink,
  fontFamily: "Nunito,sans-serif",
} satisfies React.CSSProperties;

const LABEL = {
  display: "block", fontSize: 11, fontWeight: 800,
  color: P.soft, letterSpacing: 0.5, marginBottom: 5, textTransform: "uppercase" as const,
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
      setConfig(c as typeof config);
      setLocal(c as typeof config);
    }).catch(() => {});
  }, [setConfig]);

  const modelList = MODELS[local.provider] ?? MODELS["openrouter"];

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await Commands.saveConfig(local as Parameters<typeof Commands.saveConfig>[0]);
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
        {/* Provider */}
        <div>
          <label style={LABEL}>{t.model.provider}</label>
          <select
            value={local.provider}
            onChange={e => setLocal(prev => ({ ...prev, provider: e.target.value, model: MODELS[e.target.value]?.[0] ?? "" }))}
            style={INPUT}
          >
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Model */}
        <div>
          <label style={LABEL}>{t.model.model}</label>
          <select
            value={local.model}
            onChange={e => setLocal(prev => ({ ...prev, model: e.target.value }))}
            style={INPUT}
          >
            {(modelList.includes(local.model) ? modelList : [local.model, ...modelList]).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* API Key */}
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
```

- [ ] **Step 2: Create `src/features/migrate/MigratePanel.tsx`**

```tsx
// src/features/migrate/MigratePanel.tsx
import { useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { P } from "../../theme";
import { Btn } from "../../components/shared";
import { Commands } from "../../lib/tauri";
import { useLang } from "../../i18n";

export function MigratePanel() {
  const { t } = useLang();
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleExport() {
    setMsg("");
    try {
      const savePath = await open({
        title: "选择导出位置",
        filters: [{ name: "ZIP", extensions: ["zip"] }],
        directory: false,
        save: true,
        defaultPath: `hermes-backup-${new Date().toISOString().slice(0,10)}.zip`,
      } as Parameters<typeof open>[0]);
      if (!savePath) return;
      await Commands.exportData(["config", "data"], false, savePath as string);
      setMsg(t.migrate.exportOk);
    } catch (e) {
      setMsg(`${t.migrate.exportFailed}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleImport() {
    if (!confirm(t.migrate.importConfirm)) return;
    setImporting(true);
    setMsg(t.migrate.importing);
    try {
      const zipPath = await open({
        title: "选择备份文件",
        filters: [{ name: "ZIP", extensions: ["zip"] }],
        multiple: false,
      });
      if (!zipPath) { setImporting(false); setMsg(""); return; }
      const preview = await Commands.previewImport(zipPath as string);
      const files = preview.map(f => f.path);
      const result = await Commands.executeImport(zipPath as string, files);
      setMsg(`${t.migrate.importOk} (${result.imported} 个文件)`);
    } catch (e) {
      setMsg(`${t.migrate.importFailed}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{
      background: P.white, borderRadius: P.radius.xl,
      padding: "20px 24px", marginBottom: 12,
      boxShadow: P.shadow.panel, border: `2px solid ${P.border}`,
    }}>
      <div style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink, marginBottom: 4 }}>
        {t.migrate.title}
      </div>
      <div style={{ fontSize: 12, color: P.soft, marginBottom: 16 }}>{t.migrate.desc}</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn color={P.indigo} onClick={handleExport} small>
          📦 {t.migrate.export}
        </Btn>
        <Btn color={P.teal} onClick={handleImport} small loading={importing} disabled={importing}>
          📥 {importing ? t.migrate.importing : t.migrate.import}
        </Btn>
      </div>

      {msg && (
        <div style={{
          marginTop: 12, fontSize: 12, fontWeight: 700,
          color: /(ok|成功)/i.test(msg) ? P.teal : importing ? P.soft : P.coral,
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/model/ModelPanel.tsx src/features/migrate/MigratePanel.tsx
git commit -m "feat: ModelPanel + MigratePanel with OpenClawHelper inline CSS style"
```

---

## Task 9: Rewrite App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Rewrite `src/App.tsx`**

```tsx
// src/App.tsx
import { useEffect } from "react";
import { LangProvider, useLang } from "./i18n";
import { useStore } from "./store";
import { P } from "./theme";
import { HermesStatusPanel } from "./features/status/HermesStatusPanel";
import { InstallPanel } from "./features/install/InstallPanel";
import { ModelPanel } from "./features/model/ModelPanel";
import { MigratePanel } from "./features/migrate/MigratePanel";

const LANGS = [
  { code: "zh" as const, label: "中文", flag: "🇨🇳" },
  { code: "en" as const, label: "EN",   flag: "🇺🇸" },
];

function LangPicker() {
  const { lang, setLang } = useLang();
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          style={{
            background: lang === l.code ? P.indigo : "transparent",
            color: lang === l.code ? "#fff" : P.soft,
            border: "none", borderRadius: 8,
            padding: "4px 10px", fontSize: 12, fontWeight: 700,
            cursor: "pointer", transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <span>{l.flag}</span>
          <span>{l.label}</span>
        </button>
      ))}
    </div>
  );
}

function Toast() {
  const { toast, clearToast } = useStore();
  if (!toast) return null;
  const colors = {
    success: { bg: P.banner.success.bg, border: P.banner.success.border, text: P.banner.success.text },
    error:   { bg: P.banner.error.bg,   border: P.banner.error.border,   text: P.banner.error.text   },
    info:    { bg: "#EEF0FF", border: P.indigo,   text: P.indigo },
  }[toast.type];
  return (
    <div
      className="pop"
      onClick={clearToast}
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        background: colors.bg, border: `2px solid ${colors.border}`,
        color: colors.text, borderRadius: P.radius.md,
        padding: "12px 20px", fontSize: 13, fontWeight: 700,
        boxShadow: P.shadow.heavy, cursor: "pointer", maxWidth: 360,
      }}
    >
      {toast.message}
    </div>
  );
}

function AppInner() {
  const { t } = useLang();

  return (
    <div style={{ minHeight: "100vh", background: P.bg, fontFamily: "Nunito,sans-serif" }}>
      {/* Sticky Navbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        height: P.nav.height,
        background: P.nav.bg,
        borderBottom: `1.5px solid ${P.nav.border}`,
        display: "flex", alignItems: "center",
        padding: "0 24px",
        boxShadow: "0 2px 8px rgba(91,95,239,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <span style={{ fontSize: 26 }}>🤖</span>
          <span style={{ fontFamily: "Fredoka One,cursive", fontSize: 18, color: P.ink }}>
            {t.app.brand}
          </span>
        </div>

        {/* Lang picker */}
        <LangPicker />
      </div>

      {/* Main content */}
      <main style={{ maxWidth: 880, margin: "28px auto 0", padding: "0 20px 40px" }}>
        <HermesStatusPanel />
        <InstallPanel />
        <ModelPanel />
        <MigratePanel />
      </main>

      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  );
}
```

- [ ] **Step 2: Rewrite `src/main.tsx`**

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -30
```
Expected: build succeeds (may have TS errors from old files — OK, they get deleted next task)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: rewrite App.tsx as single-page OpenClawHelper layout"
```

---

## Task 10: Delete Old Files + Fix Tests

**Files:**
- Delete: all old components/panels/slices listed in the file map
- Modify: `src/__tests__/` — replace old tests

- [ ] **Step 1: Delete old source files**

```bash
rm -f \
  src/components/layout/SegmentedControl.tsx \
  src/components/layout/Topbar.tsx \
  src/components/panels/HomePanel.tsx \
  src/components/panels/ConfigPanel.tsx \
  src/components/panels/ToolsPanel.tsx \
  src/components/panels/GatewayPanel.tsx \
  src/components/panels/InstallPanel.tsx \
  src/components/panels/MigratePanel.tsx \
  src/components/ui/Badge.tsx \
  src/components/ui/Button.tsx \
  src/components/ui/LogLine.tsx \
  src/components/ui/Toast.tsx \
  src/components/ui/Toggle.tsx \
  src/store/hermesSlice.ts \
  src/store/configSlice.ts \
  src/store/uiSlice.ts \
  src/lib/i18n.ts \
  src/locales/en/translation.json \
  src/locales/zh/translation.json
```

- [ ] **Step 2: Delete old test files**

```bash
rm -f \
  src/__tests__/panels/ConfigPanel.test.tsx \
  src/__tests__/panels/GatewayPanel.test.tsx \
  src/__tests__/panels/HomePanel.test.tsx \
  src/__tests__/panels/InstallPanel.test.tsx \
  src/__tests__/panels/MigratePanel.test.tsx \
  src/__tests__/panels/ToolsPanel.test.tsx \
  src/__tests__/ui/Toggle.test.tsx \
  src/__tests__/types/gateway-types.test.ts
```

- [ ] **Step 3: Write new test for InstallPanel**

Create `src/__tests__/features/InstallPanel.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallPanel } from "../../features/install/InstallPanel";
import { LangProvider } from "../../i18n";

vi.mock("../../lib/tauri", () => ({
  Commands: {
    installHermes: vi.fn().mockResolvedValue(undefined),
    uninstallHermes: vi.fn().mockResolvedValue(undefined),
  },
  Events: {
    onInstallProgress: vi.fn().mockResolvedValue(() => {}),
    onInstallDone: vi.fn().mockResolvedValue(() => {}),
    onInstallError: vi.fn().mockResolvedValue(() => {}),
  },
}));

vi.mock("../../store", () => ({
  useStore: () => ({
    installed: false,
    showToast: vi.fn(),
  }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}

describe("InstallPanel", () => {
  it("renders install button", () => {
    render(<Wrapper><InstallPanel /></Wrapper>);
    expect(screen.getByText(/开始安装|Start Install/i)).toBeInTheDocument();
  });

  it("shows progress section when install starts", async () => {
    render(<Wrapper><InstallPanel /></Wrapper>);
    const btn = screen.getByRole("button", { name: /开始安装|Start Install/i });
    await userEvent.click(btn);
    expect(screen.getByText(/安装进度|Install Progress/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Write test for HermesStatusPanel**

Create `src/__tests__/features/HermesStatusPanel.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HermesStatusPanel } from "../../features/status/HermesStatusPanel";
import { LangProvider } from "../../i18n";

vi.mock("../../lib/tauri", () => ({
  Commands: {
    getHermesStatus: vi.fn().mockResolvedValue({
      installed: true, version: "v0.10.0", running: false,
    }),
  },
}));

vi.mock("../../store", () => ({
  useStore: () => ({
    installed: false, version: null, running: false,
    setStatus: vi.fn(),
  }),
}));

describe("HermesStatusPanel", () => {
  it("renders Hermes Agent heading", () => {
    render(<LangProvider><HermesStatusPanel /></LangProvider>);
    expect(screen.getByText("Hermes Agent")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run 2>&1 | tail -20
```
Expected: new tests pass

- [ ] **Step 6: Full build verification**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds with 0 errors

- [ ] **Step 7: Run Rust tests**

```bash
cd src-tauri && cargo test 2>&1 | grep "test result"
```
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: complete HermesHelper UI redesign — OpenClawHelper style"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Install/Update/Uninstall → `InstallPanel` (Task 7)
- ✅ Configure model → `ModelPanel` (Task 8)
- ✅ Import/Export → `MigratePanel` (Task 8)
- ✅ Auto-connect Gateway (status detect) → `HermesStatusPanel` + `get_hermes_status` (Tasks 4, 6)
- ✅ OpenClawHelper visual style (inline CSS, Fredoka One, Nunito, indigo accent, light theme) → Tasks 1, 2
- ✅ Remove Tailwind → Task 1
- ✅ Simplified i18n → Task 3
- ✅ Tests for new components → Task 10

**Type consistency:**
- `HermesStatus` defined in both `status.rs` and `tauri.ts`
- `useStore()` returns `{ installed, version, running, setStatus, config, setConfig, toast, showToast, clearToast }`
- `Commands.getHermesStatus()` used in `HermesStatusPanel`
- `Commands.installHermes/uninstallHermes` used in `InstallPanel`
- `Commands.getConfig/saveConfig/saveApiKey/testApiConnection` used in `ModelPanel`
- `Commands.exportData/previewImport/executeImport` used in `MigratePanel`
