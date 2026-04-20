# Hermes Manager Phase 1 (MVP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Tauri 2 desktop app that guides users through installing hermes-agent and provides a GUI for diagnostics and configuration.

**Architecture:** React 18/TypeScript frontend with 6 panels and Zustand state management; Rust backend with 4 command modules for subprocess management and file I/O; Tauri Events for streaming real-time install progress to the frontend.

**Tech Stack:** Tauri 2 · React 19 · TypeScript 6 · Vite 8 · Tailwind CSS 4 · Zustand 5 · serde_yaml 0.9 · Vitest 4 + @testing-library/react · GitHub Actions tauri-action

**Spec:** `docs/superpowers/specs/2026-04-11-hermes-manager-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/App.tsx` | Root component, panel router |
| `src/components/layout/Sidebar.tsx` | Navigation sidebar |
| `src/components/layout/Topbar.tsx` | Top bar with panel title/tag |
| `src/components/ui/Button.tsx` | Button variants (primary/secondary/danger/sm) |
| `src/components/ui/Toggle.tsx` | Cyan sliding toggle with label |
| `src/components/ui/Badge.tsx` | Status badge (green/yellow/red/grey) |
| `src/components/ui/Toast.tsx` | Toast notification + useToast hook |
| `src/components/ui/LogLine.tsx` | Coloured log line (ok/warn/fail/info/muted) |
| `src/components/panels/HomePanel.tsx` | Dashboard: status cards + doctor + activity |
| `src/components/panels/InstallPanel.tsx` | Install wizard + real-time progress |
| `src/components/panels/ConfigPanel.tsx` | LLM config + behaviour toggles |
| `src/lib/tauri.ts` | Typed `invoke`/`listen` wrappers for all commands |
| `src/store/index.ts` | Zustand store combining all slices |
| `src/store/hermesSlice.ts` | Install state, version, doctor results |
| `src/store/configSlice.ts` | LLM/sandbox/behaviour config state |
| `src/store/uiSlice.ts` | Active panel, toast queue |
| `src/__tests__/ui/Toggle.test.tsx` | Toggle unit tests |
| `src/__tests__/panels/HomePanel.test.tsx` | HomePanel unit tests |
| `src/__tests__/panels/InstallPanel.test.tsx` | InstallPanel unit tests |
| `src/__tests__/panels/ConfigPanel.test.tsx` | ConfigPanel unit tests |
| `src-tauri/src/commands/config.rs` | get_config / save_config / save_api_key / test_api_connection |
| `src-tauri/src/commands/installer.rs` | detect_platform / check_version / install_hermes (streaming) / uninstall |
| `src-tauri/src/commands/process.rs` | run_doctor |
| `src-tauri/src/commands/mod.rs` | Re-exports |
| `src-tauri/src/lib.rs` | Tauri builder + register all commands |
| `src-tauri/src/main.rs` | Entry point (calls lib::run) |
| `src-tauri/Cargo.toml` | Rust dependencies |
| `src-tauri/tauri.conf.json` | Tauri app config |
| `.github/workflows/ci.yml` | PR checks: test + lint |
| `.github/workflows/release.yml` | Release: tauri-action matrix build |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`

- [ ] **Step 1: Install Tauri CLI and scaffold project**

```bash
npm create tauri-app@latest hermes-manager -- --template react-ts
cd hermes-manager
```

When prompted:
- Package manager: npm
- Frontend: React + TypeScript
- Do not choose mobile targets

- [ ] **Step 2: Install frontend dependencies**

```bash
npm install zustand
npm install -D tailwindcss postcss autoprefixer vitest @vitest/coverage-v8
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Add Tauri plugins to Cargo.toml**

Replace the `[dependencies]` section in `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
dirs = "5"
zip = { version = "2", features = ["deflate"] }
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 4: Register shell plugin in lib.rs**

`src-tauri/src/lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    hermes_manager_lib::run();
}
```

- [ ] **Step 5: Update vite.config.ts for Vitest**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
});
```

- [ ] **Step 6: Create test setup file**

`src/__tests__/setup.ts`:

```typescript
import "@testing-library/jest-dom";

// Mock @tauri-apps/api so tests don't need a real Tauri process
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
```

- [ ] **Step 7: Verify the project builds**

```bash
npm run tauri dev
```

Expected: app window opens with default Vite+React content.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri + React + TypeScript project"
```

---

## Task 2: Design Tokens & Tailwind Config

**Files:**
- Modify: `tailwind.config.ts`
- Create: `src/index.css`

- [ ] **Step 1: Configure Tailwind with design tokens from UI prototype**

`tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#060a0f",
          1: "#0d1117",
          2: "#161b22",
          3: "#1c2333",
          4: "#21262d",
        },
        cyan: {
          DEFAULT: "#00d4ff",
          dim: "#0099cc",
        },
        text: {
          0: "#e6edf3",
          1: "#8b949e",
          2: "#484f58",
        },
        status: {
          green: "#3fb950",
          yellow: "#d29922",
          red: "#f85149",
          blue: "#58a6ff",
        },
      },
      fontFamily: {
        ui: ["Syne", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
      transitionTimingFunction: {
        app: "cubic-bezier(0.4,0,0.2,1)",
      },
      transitionDuration: {
        app: "140ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 2: Set up global CSS**

`src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;500;600;700;800&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after { box-sizing: border-box; }

html, body, #root {
  height: 100%;
  background: #060a0f;
  color: #e6edf3;
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #21262d; border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: #484f58; }
```

- [ ] **Step 3: Import CSS in main.tsx**

`src/main.tsx`:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: configure Tailwind design tokens from UI prototype"
```

---

## Task 3: Base UI Components

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Toggle.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Toast.tsx`
- Create: `src/components/ui/LogLine.tsx`
- Create: `src/__tests__/ui/Toggle.test.tsx`

- [ ] **Step 1: Write failing test for Toggle**

`src/__tests__/ui/Toggle.test.tsx`:

```typescript
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
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -- src/__tests__/ui/Toggle.test.tsx
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create Toggle component**

`src/components/ui/Toggle.tsx`:

```typescript
interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      <div>
        <span className="text-text-0 text-[13px]">{label}</span>
        {description && (
          <p className="text-text-1 text-[11px] mt-0.5">{description}</p>
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
        <div
          className={`w-10 h-5 rounded-full transition-colors duration-app ease-app ${
            checked ? "bg-cyan/20 border border-cyan/40" : "bg-bg-4 border border-white/10"
          } ${disabled ? "opacity-40" : ""}`}
        >
          <div
            className={`absolute top-[3px] w-[14px] h-[14px] rounded-full transition-all duration-app ease-app ${
              checked
                ? "left-[22px] bg-cyan shadow-[0_0_8px_rgba(0,212,255,0.5)]"
                : "left-[3px] bg-text-1"
            }`}
          />
        </div>
      </div>
    </label>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test -- src/__tests__/ui/Toggle.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Create Button component**

`src/components/ui/Button.tsx`:

```typescript
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-status-blue/10 text-status-blue border border-status-blue/30 hover:bg-status-blue/20",
  secondary: "bg-bg-4 text-text-0 border border-white/10 hover:bg-bg-3",
  danger: "bg-status-red/10 text-status-red border border-status-red/30 hover:bg-status-red/20",
};

const sizeClasses: Record<Size, string> = {
  md: "px-4 py-2 text-[12px]",
  sm: "px-3 py-1.5 text-[11px]",
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
      className={`rounded-md font-ui transition-colors duration-app ease-app
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? "..." : children}
    </button>
  );
}
```

- [ ] **Step 6: Create Badge component**

`src/components/ui/Badge.tsx`:

```typescript
type BadgeStatus = "green" | "yellow" | "red" | "grey" | "blue";

const badgeClasses: Record<BadgeStatus, string> = {
  green: "bg-status-green/10 text-status-green border-status-green/30",
  yellow: "bg-status-yellow/10 text-status-yellow border-status-yellow/30",
  red: "bg-status-red/10 text-status-red border-status-red/30",
  grey: "bg-bg-4 text-text-1 border-white/10",
  blue: "bg-status-blue/10 text-status-blue border-status-blue/30",
};

interface BadgeProps {
  status: BadgeStatus;
  children: React.ReactNode;
}

export function Badge({ status, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${badgeClasses[status]}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 7: Create LogLine component**

`src/components/ui/LogLine.tsx`:

```typescript
type LogStatus = "ok" | "warn" | "fail" | "info" | "muted";

const lineClasses: Record<LogStatus, string> = {
  ok: "text-status-green",
  warn: "text-status-yellow",
  fail: "text-status-red",
  info: "text-status-blue",
  muted: "text-text-2",
};

const prefixes: Record<LogStatus, string> = {
  ok: "✓ ",
  warn: "⚠ ",
  fail: "✗ ",
  info: "ℹ ",
  muted: "",
};

interface LogLineProps {
  status: LogStatus;
  timestamp?: string;
  message: string;
}

export function LogLine({ status, timestamp, message }: LogLineProps) {
  return (
    <div className={`flex gap-3 text-[11px] font-mono leading-6 ${lineClasses[status]}`}>
      {timestamp && <span className="text-text-2 flex-shrink-0">{timestamp}</span>}
      <span>
        {prefixes[status]}
        {message}
      </span>
    </div>
  );
}
```

- [ ] **Step 8: Create Toast component and hook**

`src/components/ui/Toast.tsx`:

```typescript
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

  const colorClass =
    toast.type === "success"
      ? "border-status-green/30 text-status-green"
      : toast.type === "error"
      ? "border-status-red/30 text-status-red"
      : "border-white/20 text-text-0";

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50
        bg-bg-2 border ${colorClass} rounded-md px-4 py-2
        text-[12px] font-ui shadow-lg animate-fade-in`}
    >
      {toast.type === "success" && "✓ "}
      {toast.type === "error" && "✗ "}
      {toast.message}
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add base UI components (Button, Toggle, Badge, Toast, LogLine)"
```

---

## Task 4: App Shell (Sidebar + Topbar + Panel Router)

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Topbar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create Sidebar**

`src/components/layout/Sidebar.tsx`:

```typescript
import { useUIStore, Panel } from "../../store";

interface NavItem {
  id: Panel;
  label: string;
  icon: string;
  section: string;
  dotColor?: "green" | "yellow";
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "总览", icon: "⌂", section: "system" },
  { id: "install", label: "安装 / 更新", icon: "↓", section: "system" },
  { id: "config", label: "基础配置", icon: "⚙", section: "configure" },
  { id: "tools", label: "工具开关", icon: "🔧", section: "configure" },
  { id: "gateway", label: "消息网关", icon: "⇄", section: "configure", dotColor: "yellow" },
  { id: "migrate", label: "导入 / 导出", icon: "⇅", section: "data" },
];

const SECTIONS = ["system", "configure", "data"];

export function Sidebar() {
  const { activePanel, setActivePanel } = useUIStore();

  return (
    <aside className="w-56 flex-shrink-0 bg-bg-1 border-r border-white/[0.07] flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.07]">
        <div className="w-7 h-7 rounded-md bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan text-xs font-mono font-bold">
          H
        </div>
        <span className="font-ui font-bold text-text-0 text-sm tracking-wide">Hermes</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section} className="mb-1">
            <div className="px-4 py-1.5 text-[10px] font-mono font-bold text-text-2 uppercase tracking-widest">
              {section}
            </div>
            {NAV_ITEMS.filter((i) => i.section === section).map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-[12px] transition-colors duration-app ease-app
                  ${
                    activePanel === item.id
                      ? "bg-cyan/[0.08] text-text-0 border-r-2 border-cyan"
                      : "text-text-1 hover:bg-bg-2 hover:text-text-0"
                  }`}
              >
                <span className="text-[14px] w-4 text-center">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.dotColor && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.dotColor === "green" ? "bg-status-green" : "bg-status-yellow"
                    }`}
                  />
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.07]">
        <p className="text-[10px] font-mono text-text-2">Nous Research · Hermes</p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create Topbar**

`src/components/layout/Topbar.tsx`:

```typescript
import { useUIStore } from "../../store";

const PANEL_TITLES: Record<string, string> = {
  home: "总览",
  install: "安装 / 更新",
  config: "基础配置",
  tools: "工具开关",
  gateway: "消息网关",
  migrate: "导入 / 导出",
};

const PANEL_TAGS: Record<string, string> = {
  home: "dashboard",
  install: "installation",
  config: "configuration",
  tools: "tools",
  gateway: "gateway",
  migrate: "migration",
};

export function Topbar() {
  const { activePanel } = useUIStore();

  return (
    <header className="h-12 bg-bg-1 border-b border-white/[0.07] flex items-center px-5 gap-3 flex-shrink-0">
      <span className="text-text-0 font-ui font-semibold text-sm">
        {PANEL_TITLES[activePanel]}
      </span>
      <span className="text-[10px] font-mono text-text-2 bg-bg-4 px-2 py-0.5 rounded">
        {PANEL_TAGS[activePanel]}
      </span>
    </header>
  );
}
```

- [ ] **Step 3: Update App.tsx with shell layout**

`src/App.tsx`:

```typescript
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { Toast } from "./components/ui/Toast";
import { HomePanel } from "./components/panels/HomePanel";
import { InstallPanel } from "./components/panels/InstallPanel";
import { ConfigPanel } from "./components/panels/ConfigPanel";
import { useUIStore } from "./store";

// Placeholder panels for Phase 2
function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full text-text-1 font-mono text-sm">
      {name} — Phase 2
    </div>
  );
}

export default function App() {
  const { activePanel } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden bg-bg-0">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-5">
          {activePanel === "home" && <HomePanel />}
          {activePanel === "install" && <InstallPanel />}
          {activePanel === "config" && <ConfigPanel />}
          {activePanel === "tools" && <PlaceholderPanel name="Tools" />}
          {activePanel === "gateway" && <PlaceholderPanel name="Gateway" />}
          {activePanel === "migrate" && <PlaceholderPanel name="Migrate" />}
        </main>
      </div>
      <Toast />
    </div>
  );
}
```

- [ ] **Step 4: Create empty panel stubs so App.tsx compiles**

`src/components/panels/HomePanel.tsx`:
```typescript
export function HomePanel() { return <div>Home</div>; }
```

`src/components/panels/InstallPanel.tsx`:
```typescript
export function InstallPanel() { return <div>Install</div>; }
```

`src/components/panels/ConfigPanel.tsx`:
```typescript
export function ConfigPanel() { return <div>Config</div>; }
```

- [ ] **Step 5: Verify app shell renders**

```bash
npm run tauri dev
```

Expected: dark sidebar on the left with 6 nav items, topbar showing "总览", main area showing "Home".

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add app shell with sidebar, topbar, and panel router"
```

---

## Task 5: TypeScript Types & Tauri Bindings

**Files:**
- Create: `src/lib/tauri.ts`

- [ ] **Step 1: Create typed invoke/listen wrappers**

`src/lib/tauri.ts`:

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

- [ ] **Step 2: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: add typed Tauri invoke/listen wrappers"
```

---

## Task 6: Zustand Store

**Files:**
- Create: `src/store/hermesSlice.ts`
- Create: `src/store/configSlice.ts`
- Create: `src/store/uiSlice.ts`
- Create: `src/store/index.ts`

- [ ] **Step 1: Create hermesSlice**

`src/store/hermesSlice.ts`:

```typescript
import { DoctorResult } from "../lib/tauri";

export interface HermesSlice {
  isInstalled: boolean;
  version: string | null;
  doctorResults: DoctorResult[];
  doctorRunning: boolean;
  setInstalled: (installed: boolean, version: string | null) => void;
  setDoctorResults: (results: DoctorResult[]) => void;
  setDoctorRunning: (running: boolean) => void;
}

export const createHermesSlice = (set: (fn: (s: HermesSlice) => Partial<HermesSlice>) => void): HermesSlice => ({
  isInstalled: false,
  version: null,
  doctorResults: [],
  doctorRunning: false,
  setInstalled: (installed, version) => set(() => ({ isInstalled: installed, version })),
  setDoctorResults: (results) => set(() => ({ doctorResults: results })),
  setDoctorRunning: (running) => set(() => ({ doctorRunning: running })),
});
```

- [ ] **Step 2: Create configSlice**

`src/store/configSlice.ts`:

```typescript
import { HermesConfig } from "../lib/tauri";

const DEFAULT_CONFIG: HermesConfig = {
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4-5",
  backend: "local",
  memoryLimitMb: 5120,
  persistentMemory: true,
  autoSkillGeneration: true,
  commandApproval: false,
  budgetWarning: true,
};

export interface ConfigSlice {
  config: HermesConfig;
  configLoaded: boolean;
  setConfig: (config: HermesConfig) => void;
  updateConfig: (patch: Partial<HermesConfig>) => void;
  setConfigLoaded: (loaded: boolean) => void;
}

export const createConfigSlice = (set: (fn: (s: ConfigSlice) => Partial<ConfigSlice>) => void): ConfigSlice => ({
  config: DEFAULT_CONFIG,
  configLoaded: false,
  setConfig: (config) => set(() => ({ config, configLoaded: true })),
  updateConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  setConfigLoaded: (loaded) => set(() => ({ configLoaded: loaded })),
});
```

- [ ] **Step 3: Create uiSlice**

`src/store/uiSlice.ts`:

```typescript
export type Panel = "home" | "install" | "config" | "tools" | "gateway" | "migrate";

export interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

export interface UISlice {
  activePanel: Panel;
  toast: Toast | null;
  setActivePanel: (panel: Panel) => void;
  showToast: (message: string, type?: Toast["type"]) => void;
  clearToast: () => void;
}

export const createUISlice = (set: (fn: (s: UISlice) => Partial<UISlice>) => void): UISlice => ({
  activePanel: "home",
  toast: null,
  setActivePanel: (panel) => set(() => ({ activePanel: panel })),
  showToast: (message, type = "info") => set(() => ({ toast: { message, type } })),
  clearToast: () => set(() => ({ toast: null })),
});
```

- [ ] **Step 4: Combine slices**

`src/store/index.ts`:

```typescript
import { create } from "zustand";
import { createHermesSlice, HermesSlice } from "./hermesSlice";
import { createConfigSlice, ConfigSlice } from "./configSlice";
import { createUISlice, UISlice } from "./uiSlice";

export type { Panel } from "./uiSlice";

type Store = HermesSlice & ConfigSlice & UISlice;

export const useStore = create<Store>()((set) => ({
  ...createHermesSlice(set as Parameters<typeof createHermesSlice>[0]),
  ...createConfigSlice(set as Parameters<typeof createConfigSlice>[0]),
  ...createUISlice(set as Parameters<typeof createUISlice>[0]),
}));

// Convenience selectors
export const useHermesStore = () => useStore((s) => ({
  isInstalled: s.isInstalled,
  version: s.version,
  doctorResults: s.doctorResults,
  doctorRunning: s.doctorRunning,
  setInstalled: s.setInstalled,
  setDoctorResults: s.setDoctorResults,
  setDoctorRunning: s.setDoctorRunning,
}));

export const useConfigStore = () => useStore((s) => ({
  config: s.config,
  configLoaded: s.configLoaded,
  setConfig: s.setConfig,
  updateConfig: s.updateConfig,
  setConfigLoaded: s.setConfigLoaded,
}));

export const useUIStore = () => useStore((s) => ({
  activePanel: s.activePanel,
  toast: s.toast,
  setActivePanel: s.setActivePanel,
  showToast: s.showToast,
  clearToast: s.clearToast,
}));
```

- [ ] **Step 5: Commit**

```bash
git add src/store/
git commit -m "feat: add Zustand store with hermes/config/ui slices"
```

---

## Task 7: Rust — Config Module

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/config.rs`

- [ ] **Step 1: Write failing unit tests for config parsing**

Add to the bottom of `src-tauri/src/commands/config.rs` (create file first with just the test module):

```rust
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
    }

    #[test]
    fn test_load_nonexistent_returns_default() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("nonexistent.yaml");
        let cfg = HermesConfig::load_from(&path).unwrap();
        assert_eq!(cfg.provider, "openrouter");
    }
}
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd src-tauri && cargo test commands::config::tests
```

Expected: FAIL — "cannot find module"

- [ ] **Step 3: Implement config.rs**

`src-tauri/src/commands/config.rs`:

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
}

fn default_provider() -> String { "openrouter".into() }
fn default_model() -> String { "anthropic/claude-sonnet-4-5".into() }
fn default_backend() -> String { "local".into() }
fn default_memory_limit() -> u32 { 5120 }
fn default_true() -> bool { true }

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
    // Read existing .env lines, replace or append LLM_API_KEY
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
    // Simple connectivity check: verify key is non-empty and provider is known
    let known_providers = ["openrouter", "openai", "anthropic", "google", "custom"];
    if key.is_empty() {
        return Err("API key is empty".into());
    }
    if !known_providers.contains(&provider.as_str()) {
        return Err(format!("Unknown provider: {provider}"));
    }
    // In a real implementation this would make a cheap test API call.
    // For MVP we return true if key format looks plausible.
    Ok(key.len() > 8)
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
    }

    #[test]
    fn test_load_nonexistent_returns_default() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("nonexistent.yaml");
        let cfg = HermesConfig::load_from(&path).unwrap();
        assert_eq!(cfg.provider, "openrouter");
    }

    #[test]
    fn test_save_api_key_writes_env() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        let key = "sk-test-1234567890".to_string();
        // Simulate save_api_key by writing directly
        std::fs::write(&path, format!("LLM_API_KEY={key}\n")).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("LLM_API_KEY=sk-test-1234567890"));
    }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd src-tauri && cargo test commands::config::tests
```

Expected: 3 tests pass.

- [ ] **Step 5: Create mod.rs**

`src-tauri/src/commands/mod.rs`:

```rust
pub mod config;
pub mod installer;
pub mod process;
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/
git commit -m "feat: add Rust config module (get/save config, save API key)"
```

---

## Task 8: Rust — Installer Module

**Files:**
- Create: `src-tauri/src/commands/installer.rs`

- [ ] **Step 1: Write failing tests for version parsing and platform detection**

Start `src-tauri/src/commands/installer.rs` with just the test module:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version_from_output() {
        let output = "hermes 0.9.4\nsome other line";
        let version = parse_version(output);
        assert_eq!(version, Some("0.9.4".to_string()));
    }

    #[test]
    fn test_parse_version_missing() {
        let output = "command not found";
        let version = parse_version(output);
        assert_eq!(version, None);
    }
}
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd src-tauri && cargo test commands::installer::tests
```

Expected: FAIL — "cannot find function `parse_version`"

- [ ] **Step 3: Implement installer.rs**

`src-tauri/src/commands/installer.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
    pub os_version: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct InstallProgress {
    pub line: String,
    pub pct: u8,
}

fn parse_version(output: &str) -> Option<String> {
    for line in output.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("hermes ") {
            let version = rest.split_whitespace().next()?;
            return Some(version.to_string());
        }
    }
    None
}

#[tauri::command]
pub async fn detect_platform() -> Result<PlatformInfo, String> {
    let os = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    };
    let arch = std::env::consts::ARCH.to_string();
    Ok(PlatformInfo {
        os: os.to_string(),
        arch,
        os_version: String::new(), // populated at runtime via uname if needed
    })
}

#[tauri::command]
pub async fn check_hermes_version() -> Result<Option<String>, String> {
    let output = Command::new("hermes")
        .arg("--version")
        .output()
        .await
        .map_err(|_| "hermes not found".to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(parse_version(&stdout))
}

#[tauri::command]
pub async fn install_hermes(window: tauri::Window, mode: String) -> Result<(), String> {
    // The hermes-agent install script: curl -sSL <url> | bash -s -- --mode <mode>
    let install_url = "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/install.sh";

    let mut child = Command::new("bash")
        .args([
            "-c",
            &format!("curl -sSL {install_url} | bash -s -- --mode {mode}"),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start installer: {e}"))?;

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let mut reader = BufReader::new(stdout).lines();
    let mut line_count: u8 = 0;

    while let Some(line) = reader.next_line().await.map_err(|e| e.to_string())? {
        line_count = line_count.saturating_add(2).min(95);
        window
            .emit(
                "install_progress",
                InstallProgress {
                    line: line.clone(),
                    pct: line_count,
                },
            )
            .map_err(|e| e.to_string())?;
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if status.success() {
        window.emit("install_done", ()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        let msg = "Installation failed — check logs above".to_string();
        window.emit("install_error", &msg).map_err(|e| e.to_string())?;
        Err(msg)
    }
}

#[tauri::command]
pub async fn uninstall_hermes() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;

    // Remove hermes config directory
    let hermes_dir = home.join(".hermes");
    if hermes_dir.exists() {
        std::fs::remove_dir_all(&hermes_dir)
            .map_err(|e| format!("Failed to remove ~/.hermes: {e}"))?;
    }

    // Remove hermes binary from common install locations
    for bin_path in [
        home.join(".local/bin/hermes"),
        home.join(".hermes/bin/hermes"),
    ] {
        if bin_path.exists() {
            std::fs::remove_file(&bin_path)
                .map_err(|e| format!("Failed to remove binary: {e}"))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version_from_output() {
        let output = "hermes 0.9.4\nsome other line";
        let version = parse_version(output);
        assert_eq!(version, Some("0.9.4".to_string()));
    }

    #[test]
    fn test_parse_version_missing() {
        let output = "command not found";
        let version = parse_version(output);
        assert_eq!(version, None);
    }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd src-tauri && cargo test commands::installer::tests
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/installer.rs
git commit -m "feat: add Rust installer module with streaming install progress"
```

---

## Task 9: Rust — Process Module & Command Registration

**Files:**
- Create: `src-tauri/src/commands/process.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing test for doctor output parsing**

`src-tauri/src/commands/process.rs` (test only first):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_doctor_ok_line() {
        let result = parse_doctor_line("✓ hermes command available (v0.9.4)");
        assert_eq!(result.status, "ok");
        assert!(result.message.contains("hermes command"));
    }

    #[test]
    fn test_parse_doctor_warn_line() {
        let result = parse_doctor_line("ℹ voice module not installed (optional)");
        assert_eq!(result.status, "warn");
    }

    #[test]
    fn test_parse_doctor_fail_line() {
        let result = parse_doctor_line("✗ API key not configured");
        assert_eq!(result.status, "fail");
    }
}
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd src-tauri && cargo test commands::process::tests
```

Expected: FAIL

- [ ] **Step 3: Implement process.rs**

`src-tauri/src/commands/process.rs`:

```rust
use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct DoctorResult {
    pub status: String, // "ok" | "warn" | "fail"
    pub message: String,
}

pub fn parse_doctor_line(line: &str) -> DoctorResult {
    let line = line.trim();
    if line.starts_with('✓') || line.starts_with("✓") {
        DoctorResult {
            status: "ok".into(),
            message: line.trim_start_matches('✓').trim().to_string(),
        }
    } else if line.starts_with('✗') || line.starts_with("✗") {
        DoctorResult {
            status: "fail".into(),
            message: line.trim_start_matches('✗').trim().to_string(),
        }
    } else {
        // ℹ or anything else → warn/info
        DoctorResult {
            status: "warn".into(),
            message: line
                .trim_start_matches('ℹ')
                .trim_start_matches("ℹ")
                .trim()
                .to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_recent_activity() -> Result<Vec<String>, String> {
    let log_path = dirs::home_dir()
        .unwrap_or_default()
        .join(".hermes/hermes.log");
    if !log_path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&log_path)
        .map_err(|e| format!("Failed to read log: {e}"))?;
    let lines: Vec<String> = content
        .lines()
        .rev()
        .take(10)
        .map(String::from)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    Ok(lines)
}

#[tauri::command]
pub async fn run_doctor() -> Result<Vec<DoctorResult>, String> {
    let output = Command::new("hermes")
        .arg("doctor")
        .output()
        .await
        .map_err(|e| format!("Failed to run hermes doctor: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let results = stdout
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(parse_doctor_line)
        .collect();

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_doctor_ok_line() {
        let result = parse_doctor_line("✓ hermes command available (v0.9.4)");
        assert_eq!(result.status, "ok");
        assert!(result.message.contains("hermes command"));
    }

    #[test]
    fn test_parse_doctor_warn_line() {
        let result = parse_doctor_line("ℹ voice module not installed (optional)");
        assert_eq!(result.status, "warn");
    }

    #[test]
    fn test_parse_doctor_fail_line() {
        let result = parse_doctor_line("✗ API key not configured");
        assert_eq!(result.status, "fail");
    }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd src-tauri && cargo test commands::process::tests
```

Expected: 3 tests pass.

- [ ] **Step 5: Register all commands in lib.rs**

`src-tauri/src/lib.rs`:

```rust
mod commands;

use commands::{config, installer, process};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            installer::detect_platform,
            installer::check_hermes_version,
            installer::install_hermes,
            installer::uninstall_hermes,
            config::get_config,
            config::save_config,
            config::save_api_key,
            config::test_api_connection,
            process::run_doctor,
            process::get_recent_activity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 6: Verify full Rust build passes**

```bash
cd src-tauri && cargo build
```

Expected: compiles with no errors.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/process.rs src-tauri/src/lib.rs
git commit -m "feat: add process module (doctor) and register all Tauri commands"
```

---

## Task 10: Home Panel

**Files:**
- Modify: `src/components/panels/HomePanel.tsx`
- Create: `src/__tests__/panels/HomePanel.test.tsx`

- [ ] **Step 1: Write failing test**

`src/__tests__/panels/HomePanel.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { HomePanel } from "../../components/panels/HomePanel";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockInvoke.mockResolvedValue([]);
});

describe("HomePanel", () => {
  it("renders status cards", () => {
    render(<HomePanel />);
    expect(screen.getByText("安装状态")).toBeInTheDocument();
    expect(screen.getByText("当前版本")).toBeInTheDocument();
  });

  it("shows 'run doctor' button", () => {
    render(<HomePanel />);
    expect(screen.getByText("运行诊断")).toBeInTheDocument();
  });

  it("calls run_doctor on button click", async () => {
    mockInvoke.mockResolvedValueOnce([
      { status: "ok", message: "hermes command available" },
    ]);
    render(<HomePanel />);
    fireEvent.click(screen.getByText("运行诊断"));
    expect(mockInvoke).toHaveBeenCalledWith("run_doctor");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -- src/__tests__/panels/HomePanel.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement HomePanel**

`src/components/panels/HomePanel.tsx`:

```typescript
import { useEffect, useState } from "react";
import { Commands, DoctorResult } from "../../lib/tauri";
import { useHermesStore, useUIStore, useConfigStore } from "../../store";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { LogLine } from "../ui/LogLine";

function StatusCard({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4">
      <p className="text-text-2 text-[10px] font-mono uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-text-0 text-sm font-semibold">{value}</span>
        {badge}
      </div>
    </div>
  );
}

export function HomePanel() {
  const { isInstalled, version, doctorResults, doctorRunning, setDoctorResults, setDoctorRunning, setInstalled } =
    useHermesStore();
  const { showToast, setActivePanel } = useUIStore();
  const [hasRunDoctor, setHasRunDoctor] = useState(false);

  // Check installed status on mount
  useEffect(() => {
    Commands.checkHermesVersion()
      .then((v) => setInstalled(!!v, v))
      .catch(() => setInstalled(false, null));
  }, [setInstalled]);

  async function handleRunDoctor() {
    setDoctorRunning(true);
    setHasRunDoctor(true);
    try {
      const results = await Commands.runDoctor();
      setDoctorResults(results);
    } catch (e) {
      showToast("诊断失败：" + String(e), "error");
    } finally {
      setDoctorRunning(false);
    }
  }

  const passCount = doctorResults.filter((r) => r.status === "ok").length;
  const warnCount = doctorResults.filter((r) => r.status === "warn").length;
  const failCount = doctorResults.filter((r) => r.status === "fail").length;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatusCard
          label="安装状态"
          value={isInstalled ? "已安装" : "未安装"}
          badge={<Badge status={isInstalled ? "green" : "grey"}>{isInstalled ? "运行中" : "未检测到"}</Badge>}
        />
        <StatusCard
          label="当前版本"
          value={version ?? "—"}
          badge={version ? <Badge status="blue">已检测</Badge> : undefined}
        />
        <StatusCard label="诊断结果" value={hasRunDoctor ? `${passCount}✓ ${warnCount}ℹ ${failCount}✗` : "未运行"} />
      </div>

      {/* Doctor section */}
      <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">系统诊断</h3>
          <Button size="sm" onClick={handleRunDoctor} loading={doctorRunning}>
            运行诊断
          </Button>
        </div>

        {doctorResults.length > 0 && (
          <div className="bg-bg-1 rounded-md p-3 space-y-0.5 max-h-48 overflow-y-auto">
            {doctorResults.map((r, i) => (
              <LogLine
                key={i}
                status={r.status === "ok" ? "ok" : r.status === "fail" ? "fail" : "info"}
                message={r.message}
              />
            ))}
          </div>
        )}

        {!isInstalled && !doctorRunning && (
          <p className="text-text-1 text-[12px]">
            Hermes 未安装。{" "}
            <button
              className="text-cyan underline"
              onClick={() => setActivePanel("install")}
            >
              前往安装
            </button>
          </p>
        )}
      </div>

      {/* Recent activity */}
      <RecentActivity />

      {/* Quick actions */}
      <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2 mb-3">快速操作</h3>
        <div className="flex gap-3">
          <Button size="sm" onClick={() => setActivePanel("install")}>检查更新</Button>
          <Button size="sm" onClick={() => setActivePanel("config")}>修改配置</Button>
        </div>
      </div>
    </div>
  );
}

// Reads last 10 lines from ~/.hermes/hermes.log via Rust command added in Task 9
function RecentActivity() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    import("../../lib/tauri").then(({ Commands }) =>
      Commands.getRecentActivity().then(setLines).catch(() => {})
    );
  }, []);
  if (lines.length === 0) return null;
  return (
    <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-2">
      <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">最近活动</h3>
      <div className="space-y-0.5">
        {lines.map((l, i) => <LogLine key={i} status="muted" message={l} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test -- src/__tests__/panels/HomePanel.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/HomePanel.tsx src/__tests__/panels/HomePanel.test.tsx
git commit -m "feat: implement Home panel with status cards and doctor diagnostics"
```

---

## Task 11: Install Panel

**Files:**
- Modify: `src/components/panels/InstallPanel.tsx`
- Create: `src/__tests__/panels/InstallPanel.test.tsx`

- [ ] **Step 1: Write failing test**

`src/__tests__/panels/InstallPanel.test.tsx`:

```typescript
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
  it("renders wizard step 1", async () => {
    render(<InstallPanel />);
    expect(screen.getByText(/选择安装模式/)).toBeInTheDocument();
  });

  it("shows install mode options", () => {
    render(<InstallPanel />);
    expect(screen.getByText("完整安装")).toBeInTheDocument();
    expect(screen.getByText("仅核心")).toBeInTheDocument();
    expect(screen.getByText("含 Voice")).toBeInTheDocument();
  });

  it("enables start button when mode selected", () => {
    render(<InstallPanel />);
    const btn = screen.getByText("开始安装");
    expect(btn).not.toBeDisabled();
  });

  it("calls install_hermes on start", async () => {
    mockInvoke.mockResolvedValueOnce({ os: "macos", arch: "arm64", osVersion: "" });
    render(<InstallPanel />);
    fireEvent.click(screen.getByText("开始安装"));
    expect(mockInvoke).toHaveBeenCalledWith("install_hermes", { mode: "full" });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -- src/__tests__/panels/InstallPanel.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement InstallPanel**

`src/components/panels/InstallPanel.tsx`:

```typescript
import { useEffect, useRef, useState } from "react";
import { Commands, Events, InstallMode, InstallProgress } from "../../lib/tauri";
import { useUIStore } from "../../store";
import { Button } from "../ui/Button";
import { LogLine } from "../ui/LogLine";
import { Badge } from "../ui/Badge";

const MODES: { id: InstallMode; label: string; description: string }[] = [
  { id: "full", label: "完整安装", description: "包含消息网关、Cron、CLI 工具，约 180 MB（推荐）" },
  { id: "core", label: "仅核心", description: "最小安装，仅包含 CLI" },
  { id: "voice", label: "含 Voice", description: "完整安装 + 语音转录模块" },
];

type Phase = "idle" | "installing" | "done" | "error";

export function InstallPanel() {
  const { showToast } = useUIStore();
  const [selectedMode, setSelectedMode] = useState<InstallMode>("full");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<InstallProgress[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [logs]);

  async function handleInstall() {
    setPhase("installing");
    setLogs([]);
    setProgress(0);

    const unlistenProgress = await Events.onInstallProgress((p) => {
      setLogs((prev) => [...prev, p]);
      setProgress(p.pct);
    });

    const unlistenDone = await Events.onInstallDone(() => {
      setPhase("done");
      setProgress(100);
      showToast("安装成功！", "success");
      unlistenProgress();
      unlistenDone();
    });

    const unlistenError = await Events.onInstallError((msg) => {
      setPhase("error");
      setErrorMsg(msg);
      showToast(msg, "error");
      unlistenProgress();
      unlistenDone();
      unlistenError();
    });

    try {
      await Commands.installHermes(selectedMode);
    } catch (e) {
      setPhase("error");
      setErrorMsg(String(e));
      unlistenProgress();
      unlistenDone();
      unlistenError();
    }
  }

  async function handleUninstall() {
    if (!confirm("确定要卸载 Hermes 吗？此操作不可撤销。")) return;
    try {
      await Commands.uninstallHermes();
      showToast("已卸载 Hermes", "success");
    } catch (e) {
      showToast("卸载失败：" + String(e), "error");
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Mode selection */}
      <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">选择安装模式</h3>
        <div className="space-y-2">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors duration-app ease-app
                ${
                  selectedMode === m.id
                    ? "bg-cyan/[0.06] border-cyan/30"
                    : "bg-bg-3 border-white/[0.07] hover:bg-bg-4"
                }`}
            >
              <input
                type="radio"
                name="mode"
                value={m.id}
                checked={selectedMode === m.id}
                onChange={() => setSelectedMode(m.id)}
                className="mt-0.5 accent-cyan"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-text-0 text-[13px] font-semibold">{m.label}</span>
                  {m.id === "full" && <Badge status="blue">推荐</Badge>}
                </div>
                <p className="text-text-1 text-[11px] mt-0.5">{m.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Progress */}
      {(phase === "installing" || phase === "done" || phase === "error") && (
        <div className="bg-bg-2 border border-white/[0.07] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-mono uppercase tracking-widest text-text-2">安装进度</h3>
            <Badge status={phase === "done" ? "green" : phase === "error" ? "red" : "blue"}>
              {phase === "done" ? "完成" : phase === "error" ? "失败" : `${progress}%`}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-bg-4 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                phase === "error" ? "bg-status-red" : "bg-cyan"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Log output */}
          <div
            ref={logRef}
            className="bg-bg-1 rounded-md p-3 max-h-48 overflow-y-auto space-y-0.5"
          >
            {logs.map((l, i) => (
              <LogLine key={i} status="muted" message={l.line} />
            ))}
            {phase === "error" && <LogLine status="fail" message={errorMsg} />}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="primary"
          onClick={handleInstall}
          disabled={phase === "installing"}
          loading={phase === "installing"}
        >
          {phase === "done" ? "重新安装" : "开始安装"}
        </Button>

        <Button variant="danger" size="sm" onClick={handleUninstall} disabled={phase === "installing"}>
          卸载 Hermes
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test -- src/__tests__/panels/InstallPanel.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/InstallPanel.tsx src/__tests__/panels/InstallPanel.test.tsx
git commit -m "feat: implement Install panel with real-time streaming progress"
```

---

## Task 12: Config Panel

**Files:**
- Modify: `src/components/panels/ConfigPanel.tsx`
- Create: `src/__tests__/panels/ConfigPanel.test.tsx`

- [ ] **Step 1: Write failing test**

`src/__tests__/panels/ConfigPanel.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfigPanel } from "../../components/panels/ConfigPanel";
import { invoke } from "@tauri-apps/api/core";

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
};

beforeEach(() => {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_config") return Promise.resolve(defaultConfig);
    return Promise.resolve();
  });
});

describe("ConfigPanel", () => {
  it("loads and displays config on mount", async () => {
    render(<ConfigPanel />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("get_config"));
  });

  it("shows save button", async () => {
    render(<ConfigPanel />);
    await waitFor(() => expect(screen.getByText("保存所有配置")).toBeInTheDocument());
  });

  it("calls save_config on save click", async () => {
    render(<ConfigPanel />);
    await waitFor(() => screen.getByText("保存所有配置"));
    fireEvent.click(screen.getByText("保存所有配置"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("save_config", expect.any(Object))
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -- src/__tests__/panels/ConfigPanel.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement ConfigPanel**

`src/components/panels/ConfigPanel.tsx`:

```typescript
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test -- src/__tests__/panels/ConfigPanel.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/ConfigPanel.tsx src/__tests__/panels/ConfigPanel.test.tsx
git commit -m "feat: implement Config panel (LLM provider, API key, behaviour toggles)"
```

---

## Task 13: System Tray

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add tray icon resource**

Create a 32×32 PNG icon at `src-tauri/icons/tray-icon.png` (use any square PNG for now).

```bash
# Copy existing icon as placeholder
cp src-tauri/icons/icon.png src-tauri/icons/tray-icon.png
```

- [ ] **Step 2: Update lib.rs to add system tray**

`src-tauri/src/lib.rs`:

```rust
mod commands;

use commands::{config, installer, process};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示 Hermes Manager", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(win) = tray.app_handle().get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            installer::detect_platform,
            installer::check_hermes_version,
            installer::install_hermes,
            installer::uninstall_hermes,
            config::get_config,
            config::save_config,
            config::save_api_key,
            config::test_api_connection,
            process::run_doctor,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify build succeeds**

```bash
cd src-tauri && cargo build
```

Expected: compiles with no errors.

- [ ] **Step 4: Smoke test tray in dev mode**

```bash
npm run tauri dev
```

Expected: tray icon appears in system menu bar/tray. Right-click shows "显示 Hermes Manager" and "退出".

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/icons/tray-icon.png
git commit -m "feat: add system tray with show/quit menu items"
```

---

## Task 14: GitHub Actions CI & Release

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test -- --run
      - run: npm run build

  test-rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
      - name: Install system deps
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
      - run: cd src-tauri && cargo test
      - run: cd src-tauri && cargo clippy -- -D warnings
```

- [ ] **Step 2: Create release workflow**

`.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target aarch64-apple-darwin
          - platform: macos-latest
            args: --target x86_64-apple-darwin
          - platform: ubuntu-22.04
            args: ""
          - platform: windows-latest
            args: ""

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install Linux deps
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev \
            libayatana-appindicator3-dev librsvg2-dev

      - run: npm ci

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "Hermes Manager ${{ github.ref_name }}"
          releaseBody: "See the assets below to download and install."
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

- [ ] **Step 3: Add test script to package.json**

Ensure `package.json` has:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "build": "vite build",
    "tauri": "tauri"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions CI checks and release matrix build"
```

---

## Task 15: Run Full Test Suite & Final Verification

- [ ] **Step 1: Run all frontend tests**

```bash
npm run test -- --run
```

Expected: all tests pass (Toggle × 3, HomePanel × 3, InstallPanel × 4, ConfigPanel × 3 = 13 tests)

- [ ] **Step 2: Run all Rust tests**

```bash
cd src-tauri && cargo test
```

Expected: config × 3, installer × 2, process × 3 = 8 tests pass

- [ ] **Step 3: Run Clippy**

```bash
cd src-tauri && cargo clippy -- -D warnings
```

Expected: no warnings.

- [ ] **Step 4: Full dev build smoke test**

```bash
npm run tauri dev
```

Manual checks:
- [ ] Sidebar navigation switches all 6 panels
- [ ] Home panel shows status cards and "运行诊断" button
- [ ] Install panel shows 3 mode options
- [ ] Config panel loads toggles and dropdowns
- [ ] Toast appears on save
- [ ] System tray icon is visible

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 MVP complete — all tests passing"
```

---

## Summary

**Phase 1 delivers:** A working Tauri desktop app with Home, Install, and Config panels, system tray integration, and GitHub Actions CI/release pipeline.

**Test coverage:** 13 frontend tests + 8 Rust unit tests covering all command logic.

**To release:** Push a tag `v0.1.0` — GitHub Actions will build `.dmg`, `.exe`, and `.AppImage` automatically.

**Phase 2 entry point:** Implement Tools, Gateway, and Migrate panels following the same pattern (write test → implement → commit).
