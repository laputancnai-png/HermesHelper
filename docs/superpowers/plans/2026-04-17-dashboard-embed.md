# Dashboard Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed the Hermes web dashboard (http://127.0.0.1:9119) inside a new Dashboard tab, auto-starting `hermes dashboard --no-open` when the app launches.

**Architecture:** Tauri's `setup` hook spawns `hermes dashboard --no-open` as a detached process on app start. A new Rust command `check_dashboard_ready` probes TCP port 9119 so the frontend can poll readiness before showing the iframe. The Dashboard tab renders a full-height iframe once the server is ready, with a loading spinner and retry button for the startup window.

**Tech Stack:** Rust (std::process::Command, tokio::net::TcpStream), React/TypeScript, Tauri v2 invoke

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src-tauri/src/commands/dashboard.rs` | `check_dashboard_ready` Tauri command |
| Modify | `src-tauri/src/commands/mod.rs` | expose `pub mod dashboard` |
| Modify | `src-tauri/src/lib.rs` | spawn process in setup; register command |
| Create | `src/features/dashboard/DashboardPage.tsx` | iframe + loading/retry UI |
| Modify | `src/App.tsx` | add Dashboard nav tab |
| Modify | `src/i18n.tsx` | dashboard i18n strings |
| Modify | `src/lib/tauri.ts` | `checkDashboardReady` command wrapper |

---

### Task 1: Rust — `check_dashboard_ready` command + process spawn

**Files:**
- Create: `src-tauri/src/commands/dashboard.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create `dashboard.rs`**

```rust
// src-tauri/src/commands/dashboard.rs
#[tauri::command]
pub async fn check_dashboard_ready() -> bool {
    tokio::net::TcpStream::connect("127.0.0.1:9119").await.is_ok()
}
```

- [ ] **Step 2: Add module to `mod.rs`**

In `src-tauri/src/commands/mod.rs`, add one line at the top:

```rust
pub mod chat;
pub mod config;
pub mod dashboard;   // ← add this
pub mod gateway;
pub mod installer;
pub mod migrate;
pub mod process;
pub mod status;
pub mod tools;
```

- [ ] **Step 3: Wire into `lib.rs` — use statement**

In `src-tauri/src/lib.rs`, change the use line from:
```rust
use commands::{chat, config, gateway, installer, migrate, process, status, tools};
```
to:
```rust
use commands::{chat, config, dashboard, gateway, installer, migrate, process, status, tools};
```

- [ ] **Step 4: Spawn process in setup hook**

Inside the `setup` closure in `lib.rs`, add the spawn call right before `Ok(())`:

```rust
        .setup(|app| {
            // ... existing tray code ...

            // Start Hermes dashboard in background (no browser open)
            let _ = std::process::Command::new("hermes")
                .args(["dashboard", "--no-open"])
                .spawn();

            Ok(())
        })
```

- [ ] **Step 5: Register command in invoke_handler**

In `lib.rs`, add `dashboard::check_dashboard_ready` to the handler list:

```rust
        .invoke_handler(tauri::generate_handler![
            chat::hermes_chat,
            dashboard::check_dashboard_ready,   // ← add this
            installer::detect_platform,
            // ... rest unchanged ...
        ])
```

- [ ] **Step 6: Build and verify**

```bash
cd /Users/laputancnai/HermesHelper
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: `Compiling hermes-manager ...` then `Finished`. Zero errors.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/dashboard.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add check_dashboard_ready command; spawn hermes dashboard on app start"
```

---

### Task 2: Frontend — `checkDashboardReady` wrapper + DashboardPage

**Files:**
- Modify: `src/lib/tauri.ts`
- Create: `src/features/dashboard/DashboardPage.tsx`

- [ ] **Step 1: Add command wrapper to `tauri.ts`**

In `src/lib/tauri.ts`, add inside the `Commands` object after `hermesChat`:

```typescript
  checkDashboardReady: (): Promise<boolean> =>
    tauriInvoke("check_dashboard_ready"),
```

- [ ] **Step 2: Create `DashboardPage.tsx`**

```tsx
// src/features/dashboard/DashboardPage.tsx
import { useEffect, useState, useCallback } from "react";
import { theme as P } from "../../theme";
import { Btn } from "../../components/shared";
import { useLang } from "../../i18n";
import { Commands } from "../../lib/tauri";

const DASHBOARD_URL = "http://127.0.0.1:9119";
const POLL_INTERVAL_MS = 500;
const POLL_MAX_ATTEMPTS = 30; // 15 seconds

export function DashboardPage() {
  const { t } = useLang();
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const startPolling = useCallback(() => {
    setReady(false);
    setTimedOut(false);
    setAttempts(0);
  }, []);

  useEffect(() => {
    if (ready || timedOut) return;

    const id = setInterval(async () => {
      setAttempts(prev => {
        if (prev >= POLL_MAX_ATTEMPTS) {
          clearInterval(id);
          setTimedOut(true);
          return prev;
        }
        return prev + 1;
      });

      const ok = await Commands.checkDashboardReady();
      if (ok) {
        clearInterval(id);
        setReady(true);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [ready, timedOut]);

  if (ready) {
    return (
      <div style={{ height: "calc(100vh - 100px)", minHeight: 500, borderRadius: 16, overflow: "hidden", border: "2px solid #EBEBF8" }}>
        <iframe
          src={DASHBOARD_URL}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="Hermes Dashboard"
        />
      </div>
    );
  }

  return (
    <div style={{
      height: "calc(100vh - 100px)", minHeight: 500,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: P.white, borderRadius: 22,
      border: "2px solid #EBEBF8", boxShadow: "0 8px 24px #00000010",
      gap: 16,
    }}>
      {timedOut ? (
        <>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <div style={{ fontSize: 14, color: P.ink, fontWeight: 700 }}>{t.dashboard.timeout}</div>
          <div style={{ fontSize: 12, color: P.soft }}>{t.dashboard.timeoutHint}</div>
          <Btn small onClick={startPolling}>{t.dashboard.retry}</Btn>
        </>
      ) : (
        <>
          <span className="spin" style={{ fontSize: 32 }}>⚙️</span>
          <div style={{ fontSize: 14, color: P.ink, fontWeight: 700 }}>{t.dashboard.loading}</div>
          <div style={{ fontSize: 12, color: P.soft }}>
            {t.dashboard.loadingHint} ({attempts}/{POLL_MAX_ATTEMPTS})
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauri.ts src/features/dashboard/DashboardPage.tsx
git commit -m "feat: add DashboardPage with iframe and readiness polling"
```

---

### Task 3: Wire up nav tab + i18n

**Files:**
- Modify: `src/i18n.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add dashboard strings to `i18n.tsx`**

In the `ZH` object, add a `dashboard` key after `chat`:

```typescript
  dashboard: {
    loading: "正在启动 Dashboard...",
    loadingHint: "Hermes Dashboard 正在初始化",
    timeout: "Dashboard 启动超时",
    timeoutHint: "请检查 Hermes 是否已正确安装",
    retry: "重试",
  },
```

In the `EN` object, add:

```typescript
  dashboard: {
    loading: "Starting Dashboard...",
    loadingHint: "Hermes Dashboard is initializing",
    timeout: "Dashboard timed out",
    timeoutHint: "Please check that Hermes is installed correctly",
    retry: "Retry",
  },
```

- [ ] **Step 2: Add nav tab and import in `App.tsx`**

Add the import at the top of `App.tsx`:

```typescript
import { DashboardPage } from "./features/dashboard/DashboardPage";
```

Change the `page` state type and `NAV_TABS` in `AppInner`:

```typescript
const [page, setPage] = useState<"manage" | "chat" | "dashboard">("manage");

const NAV_TABS = [
  { id: "manage"    as const, label: t.nav.manage,    emoji: "🤖" },
  { id: "chat"      as const, label: t.nav.chat,      emoji: ""   },
  { id: "dashboard" as const, label: t.nav.dashboard, emoji: "📊" },
];
```

Update the emoji render condition in the tab button (currently only renders emoji for "manage"):

```tsx
{(tab.id === "manage") && <span>{tab.emoji}</span>}
```

stays the same — dashboard and chat tabs have emoji embedded in their label strings, OR you can render emoji for dashboard too:

```tsx
{(tab.id === "manage" || tab.id === "dashboard") && <span>{tab.emoji}</span>}
```

Add the page render at the bottom of `<main>`:

```tsx
{page === "manage" && (
  <>
    <HermesStatusPanel />
    <InstallPanel />
    <ModelPanel />
    <MigratePanel />
  </>
)}
{page === "chat" && <ChatPage />}
{page === "dashboard" && <DashboardPage />}
```

- [ ] **Step 3: Add `dashboard` nav label to i18n**

In `ZH.nav`:
```typescript
nav: { lang: "语言", manage: "管理", chat: "💬 聊天", dashboard: "📊 Dashboard" },
```

In `EN.nav`:
```typescript
nav: { lang: "Language", manage: "Manage", chat: "💬 Chat", dashboard: "📊 Dashboard" },
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/laputancnai/HermesHelper
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/i18n.tsx src/App.tsx
git commit -m "feat: add Dashboard tab with Hermes web UI embed"
```

---

### Task 4: Smoke test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/laputancnai/HermesHelper
npm run tauri dev
```

- [ ] **Step 2: Verify**

1. App launches — confirm no browser window opened by `hermes dashboard`
2. Click "📊 Dashboard" tab — see loading spinner with counter
3. Within ~5 seconds, spinner disappears and Hermes dashboard appears in iframe
4. Switch to other tabs and back — iframe stays loaded
5. Click "💬 聊天" tab — chat still works normally
