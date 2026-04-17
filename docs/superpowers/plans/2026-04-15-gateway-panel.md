# Gateway 面板实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Hermes Manager 桌面应用中实现 Gateway 面板——配置 Telegram Bot Token / Allowed Users、管理 hermes gateway 进程（启动/停止/状态轮询）。

**Architecture:** Rust 后端负责读写 `~/.hermes/.env`、spawn/kill `hermes gateway run/stop`、检测 `~/.hermes/gateway.pid` 进程活跃状态；TypeScript 层提供强类型绑定；React 前端 Layout C（配置在上，状态+控制在下）。与 ToolsPanel 结构完全一致：testable helper functions 接收 `&Path`，Tauri command 调用真实路径。

**Tech Stack:** Tauri 2 / Rust (tokio, serde, dirs, tempfile for tests) · React 18 + TypeScript + Tailwind CSS v4 · react-i18next · Vitest + @testing-library/react

---

## 文件一览

| 操作 | 路径 | 职责 |
|------|------|------|
| 新建 | `src-tauri/src/commands/gateway.rs` | 5 个 Tauri 命令 + 3 个 testable helpers + 5 个单元测试 |
| 修改 | `src-tauri/src/commands/mod.rs` | 追加 `pub mod gateway;` |
| 修改 | `src-tauri/src/lib.rs` | use + invoke_handler 追加 5 个 gateway 命令 |
| 修改 | `src/lib/tauri.ts` | 追加 GatewayConfig / GatewayStatus 类型 + 5 个 Commands |
| 修改 | `src/locales/zh/translation.json` | 追加 `"gateway"` 块（19 个键） |
| 修改 | `src/locales/en/translation.json` | 追加 `"gateway"` 块（19 个键） |
| 新建 | `src/components/panels/GatewayPanel.tsx` | React 组件，Layout C |
| 新建 | `src/__tests__/panels/GatewayPanel.test.tsx` | 6 个前端测试 |
| 修改 | `src/App.tsx` | `gateway` 分支改为 `<GatewayPanel />` |

---

## Task 1: Rust 后端 — `gateway.rs`

**Files:**
- Create: `src-tauri/src/commands/gateway.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写 5 个失败测试**

新建 `src-tauri/src/commands/gateway.rs`，内容仅包含测试模块（函数尚未实现，会编译失败）：

```rust
use std::path::{Path, PathBuf};

// ── 数据结构（测试用，暂时 stub）────────────────────────────────────

pub struct GatewayConfig {
    pub bot_token: String,
    pub allowed_users: String,
}

pub struct GatewayStatus {
    pub running: bool,
}

// ── 未实现的 helpers（测试用占位）────────────────────────────────────

pub(crate) fn get_gateway_config_from(_env_path: &Path) -> Result<GatewayConfig, String> {
    unimplemented!()
}

pub(crate) fn save_gateway_config_to(_env_path: &Path, _config: &GatewayConfig) -> Result<(), String> {
    unimplemented!()
}

pub(crate) fn get_gateway_status_from(_pid_path: &Path) -> GatewayStatus {
    unimplemented!()
}

// ── Tests ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_get_config_missing_file_returns_empty() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        let config = get_gateway_config_from(&path).unwrap();
        assert_eq!(config.bot_token, "");
        assert_eq!(config.allowed_users, "");
    }

    #[test]
    fn test_get_config_reads_token_from_env() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        std::fs::write(&path, "TELEGRAM_BOT_TOKEN=1234:ABC\nTELEGRAM_ALLOWED_USERS=111,222\n").unwrap();
        let config = get_gateway_config_from(&path).unwrap();
        assert_eq!(config.bot_token, "1234:ABC");
        assert_eq!(config.allowed_users, "111,222");
    }

    #[test]
    fn test_save_config_preserves_other_fields() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        std::fs::write(&path, "OTHER_VAR=keep_me\nTELEGRAM_BOT_TOKEN=old\n").unwrap();
        let config = GatewayConfig {
            bot_token: "new_token".to_string(),
            allowed_users: "42".to_string(),
        };
        save_gateway_config_to(&path, &config).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("OTHER_VAR=keep_me"), "Other env vars must be preserved");
        assert!(content.contains("TELEGRAM_BOT_TOKEN=new_token"));
        assert!(content.contains("TELEGRAM_ALLOWED_USERS=42"));
        assert!(!content.contains("TELEGRAM_BOT_TOKEN=old"));
    }

    #[test]
    fn test_save_config_creates_file_if_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        assert!(!path.exists());
        let config = GatewayConfig {
            bot_token: "tok".to_string(),
            allowed_users: "".to_string(),
        };
        save_gateway_config_to(&path, &config).unwrap();
        assert!(path.exists());
        let reloaded = get_gateway_config_from(&path).unwrap();
        assert_eq!(reloaded.bot_token, "tok");
    }

    #[test]
    fn test_get_status_no_pid_file_returns_not_running() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("gateway.pid");
        let status = get_gateway_status_from(&path);
        assert!(!status.running);
    }
}
```

- [ ] **Step 2: 验证测试失败（unimplemented! panic）**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1/src-tauri
cargo test gateway 2>&1 | head -30
```

预期：所有 5 个测试 FAIL（panicked at 'not yet implemented'）。

- [ ] **Step 3: 实现 helpers 与 Tauri commands**

将 `src-tauri/src/commands/gateway.rs` 替换为完整实现：

```rust
use serde::Serialize;
use std::path::{Path, PathBuf};

// ── Path helpers ──────────────────────────────────────────────────

fn env_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())
        .map(|h| h.join(".hermes").join(".env"))
}

fn pid_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())
        .map(|h| h.join(".hermes").join("gateway.pid"))
}

// ── Domain types ──────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    pub bot_token: String,
    pub allowed_users: String,
}

#[derive(Serialize)]
pub struct GatewayStatus {
    pub running: bool,
}

// ── Testable helpers ──────────────────────────────────────────────

pub(crate) fn get_gateway_config_from(env_path: &Path) -> Result<GatewayConfig, String> {
    if !env_path.exists() {
        return Ok(GatewayConfig {
            bot_token: String::new(),
            allowed_users: String::new(),
        });
    }
    let content = std::fs::read_to_string(env_path)
        .map_err(|e| format!("Failed to read .env: {e}"))?;

    let mut bot_token = String::new();
    let mut allowed_users = String::new();

    for line in content.lines() {
        if let Some(val) = line.strip_prefix("TELEGRAM_BOT_TOKEN=") {
            bot_token = val.to_string();
        } else if let Some(val) = line.strip_prefix("TELEGRAM_ALLOWED_USERS=") {
            allowed_users = val.to_string();
        }
    }

    Ok(GatewayConfig {
        bot_token,
        allowed_users,
    })
}

pub(crate) fn save_gateway_config_to(
    env_path: &Path,
    config: &GatewayConfig,
) -> Result<(), String> {
    let existing = if env_path.exists() {
        std::fs::read_to_string(env_path)
            .map_err(|e| format!("Failed to read .env: {e}"))?
    } else {
        String::new()
    };

    let mut lines: Vec<String> = existing
        .lines()
        .filter(|l| {
            !l.starts_with("TELEGRAM_BOT_TOKEN=")
                && !l.starts_with("TELEGRAM_ALLOWED_USERS=")
        })
        .map(String::from)
        .collect();

    lines.push(format!("TELEGRAM_BOT_TOKEN={}", config.bot_token));
    lines.push(format!("TELEGRAM_ALLOWED_USERS={}", config.allowed_users));

    if let Some(parent) = env_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    let content = lines.join("\n") + "\n";
    std::fs::write(env_path, content)
        .map_err(|e| format!("Failed to write .env: {e}"))
}

pub(crate) fn get_gateway_status_from(pid_path: &Path) -> GatewayStatus {
    if !pid_path.exists() {
        return GatewayStatus { running: false };
    }
    let content = match std::fs::read_to_string(pid_path) {
        Ok(c) => c,
        Err(_) => return GatewayStatus { running: false },
    };
    let pid_str = content.trim().to_string();
    let running = std::process::Command::new("kill")
        .args(["-0", &pid_str])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    GatewayStatus { running }
}

// ── Tauri commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn get_gateway_config() -> Result<GatewayConfig, String> {
    get_gateway_config_from(&env_path()?)
}

#[tauri::command]
pub async fn save_gateway_config(
    bot_token: String,
    allowed_users: String,
) -> Result<(), String> {
    let config = GatewayConfig {
        bot_token,
        allowed_users,
    };
    save_gateway_config_to(&env_path()?, &config)
}

#[tauri::command]
pub async fn get_gateway_status() -> GatewayStatus {
    match pid_path() {
        Ok(p) => get_gateway_status_from(&p),
        Err(_) => GatewayStatus { running: false },
    }
}

#[tauri::command]
pub async fn start_gateway() -> Result<(), String> {
    std::process::Command::new("hermes")
        .args(["gateway", "run"])
        .spawn()
        .map_err(|e| format!("Failed to start gateway: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn stop_gateway() -> Result<(), String> {
    use std::time::Duration;

    // Try hermes gateway stop (timeout 10s)
    let result = tokio::time::timeout(
        Duration::from_secs(10),
        tokio::process::Command::new("hermes")
            .args(["gateway", "stop"])
            .status(),
    )
    .await;

    if let Ok(Ok(status)) = result {
        if status.success() {
            return Ok(());
        }
    }

    // Fallback: send SIGTERM via PID file
    let pid_file = pid_path()?;
    if pid_file.exists() {
        let content = std::fs::read_to_string(&pid_file)
            .map_err(|e| format!("Failed to read gateway.pid: {e}"))?;
        let pid_str = content.trim().to_string();
        std::process::Command::new("kill")
            .args(["-TERM", &pid_str])
            .spawn()
            .map_err(|e| format!("Failed to send SIGTERM: {e}"))?;
    }

    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_get_config_missing_file_returns_empty() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        let config = get_gateway_config_from(&path).unwrap();
        assert_eq!(config.bot_token, "");
        assert_eq!(config.allowed_users, "");
    }

    #[test]
    fn test_get_config_reads_token_from_env() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        std::fs::write(&path, "TELEGRAM_BOT_TOKEN=1234:ABC\nTELEGRAM_ALLOWED_USERS=111,222\n")
            .unwrap();
        let config = get_gateway_config_from(&path).unwrap();
        assert_eq!(config.bot_token, "1234:ABC");
        assert_eq!(config.allowed_users, "111,222");
    }

    #[test]
    fn test_save_config_preserves_other_fields() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        std::fs::write(&path, "OTHER_VAR=keep_me\nTELEGRAM_BOT_TOKEN=old\n").unwrap();
        let config = GatewayConfig {
            bot_token: "new_token".to_string(),
            allowed_users: "42".to_string(),
        };
        save_gateway_config_to(&path, &config).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("OTHER_VAR=keep_me"), "Other env vars must be preserved");
        assert!(content.contains("TELEGRAM_BOT_TOKEN=new_token"));
        assert!(content.contains("TELEGRAM_ALLOWED_USERS=42"));
        assert!(!content.contains("TELEGRAM_BOT_TOKEN=old"));
    }

    #[test]
    fn test_save_config_creates_file_if_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        assert!(!path.exists());
        let config = GatewayConfig {
            bot_token: "tok".to_string(),
            allowed_users: "".to_string(),
        };
        save_gateway_config_to(&path, &config).unwrap();
        assert!(path.exists());
        let reloaded = get_gateway_config_from(&path).unwrap();
        assert_eq!(reloaded.bot_token, "tok");
    }

    #[test]
    fn test_get_status_no_pid_file_returns_not_running() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("gateway.pid");
        let status = get_gateway_status_from(&path);
        assert!(!status.running);
    }
}
```

- [ ] **Step 4: 注册 module — 修改 `src-tauri/src/commands/mod.rs`**

在文件末尾追加一行：

```rust
pub mod config;
pub mod installer;
pub mod process;
pub mod tools;
pub mod gateway;
```

- [ ] **Step 5: 注册 commands — 修改 `src-tauri/src/lib.rs`**

将 `use commands::{...}` 行改为：

```rust
use commands::{config, installer, process, tools, gateway};
```

在 `invoke_handler!` 的 `tools::save_tools,` 后追加：

```rust
        gateway::get_gateway_config,
        gateway::save_gateway_config,
        gateway::get_gateway_status,
        gateway::start_gateway,
        gateway::stop_gateway,
```

完整的 `invoke_handler!` 块应为：

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
            tools::get_tools,
            tools::save_tools,
            gateway::get_gateway_config,
            gateway::save_gateway_config,
            gateway::get_gateway_status,
            gateway::start_gateway,
            gateway::stop_gateway,
        ])
```

- [ ] **Step 6: 运行测试，验证 5 个测试全部通过**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1/src-tauri
cargo test gateway 2>&1
```

预期输出（5 个 ok）：
```
test commands::gateway::tests::test_get_config_missing_file_returns_empty ... ok
test commands::gateway::tests::test_get_config_reads_token_from_env ... ok
test commands::gateway::tests::test_save_config_preserves_other_fields ... ok
test commands::gateway::tests::test_save_config_creates_file_if_missing ... ok
test commands::gateway::tests::test_get_status_no_pid_file_returns_not_running ... ok

test result: ok. 5 passed; 0 failed
```

若失败，查看错误信息后修复（常见问题：serde derive 缺 `#[derive(Serialize)]`；`tokio::process` 需 `tokio` full feature — Cargo.toml 已有）。

- [ ] **Step 7: 运行全量 Rust 测试，确保无回归**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1/src-tauri
cargo test 2>&1 | tail -10
```

预期：所有既有测试 + 5 个新测试均通过，无 FAILED。

- [ ] **Step 8: cargo fmt**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1/src-tauri
cargo fmt
```

- [ ] **Step 9: Commit**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
git add src-tauri/src/commands/gateway.rs \
        src-tauri/src/commands/mod.rs \
        src-tauri/src/lib.rs
git commit -m "feat: add gateway Rust backend (config, start/stop/status)"
```

---

## Task 2: TypeScript 绑定 + i18n

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/locales/zh/translation.json`
- Modify: `src/locales/en/translation.json`

- [ ] **Step 1: 写失败测试（验证类型存在）**

新建 `src/__tests__/types/gateway-types.test.ts`（仅类型检查，无 runtime 断言）：

```typescript
import type { GatewayConfig, GatewayStatus } from "../../lib/tauri";
import { Commands } from "../../lib/tauri";

// Type-only smoke tests — if these compile, types are correct.
// If GatewayConfig or GatewayStatus don't exist, tsc will fail.
const _cfg: GatewayConfig = { botToken: "", allowedUsers: "" };
const _status: GatewayStatus = { running: false };
const _fn1: () => Promise<GatewayConfig> = Commands.getGatewayConfig;
const _fn2: (t: string, u: string) => Promise<void> = Commands.saveGatewayConfig;
const _fn3: () => Promise<GatewayStatus> = Commands.getGatewayStatus;
const _fn4: () => Promise<void> = Commands.startGateway;
const _fn5: () => Promise<void> = Commands.stopGateway;

export {};
```

运行确认失败：

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npx tsc --noEmit 2>&1 | grep gateway
```

预期：报错 `Property 'getGatewayConfig' does not exist on type ...`。

- [ ] **Step 2: 追加 TypeScript 类型与 Commands 到 `src/lib/tauri.ts`**

在 `ToolId` 类型定义后（第 48 行后）追加：

```typescript
export interface GatewayConfig {
  botToken: string;
  allowedUsers: string;
}

export interface GatewayStatus {
  running: boolean;
}
```

在 `Commands` 对象中，`saveTools` 后追加：

```typescript
  getGatewayConfig: (): Promise<GatewayConfig> =>
    tauriInvoke("get_gateway_config"),

  saveGatewayConfig: (botToken: string, allowedUsers: string): Promise<void> =>
    tauriInvoke("save_gateway_config", { botToken, allowedUsers }),

  getGatewayStatus: (): Promise<GatewayStatus> =>
    tauriInvoke("get_gateway_status"),

  startGateway: (): Promise<void> =>
    tauriInvoke("start_gateway"),

  stopGateway: (): Promise<void> =>
    tauriInvoke("stop_gateway"),
```

- [ ] **Step 3: 运行类型检查，验证通过**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npx tsc --noEmit 2>&1
```

预期：无错误输出（exit 0）。

- [ ] **Step 4: 追加中文 i18n 键到 `src/locales/zh/translation.json`**

在 `"tools"` 块后、`"toast"` 块前，追加：

```json
  "gateway": {
    "section":       "TELEGRAM 配置",
    "botToken":      "Bot Token",
    "allowedUsers":  "允许的用户 ID（逗号分隔）",
    "saveConfig":    "保存配置",
    "saved":         "已保存",
    "saveFailed":    "保存失败",
    "loadFailed":    "配置加载失败",
    "statusSection": "网关状态",
    "running":       "运行中",
    "stopped":       "未运行",
    "starting":      "启动中...",
    "stopping":      "停止中...",
    "start":         "启动",
    "stop":          "停止",
    "startFailed":   "启动失败",
    "stopFailed":    "停止失败",
    "noTokenHint":   "请先保存 Bot Token",
    "show":          "显示",
    "hide":          "隐藏",
    "loading":       "加载中..."
  },
```

- [ ] **Step 5: 追加英文 i18n 键到 `src/locales/en/translation.json`**

在 `"tools"` 块后、`"toast"` 块前，追加：

```json
  "gateway": {
    "section":       "TELEGRAM CONFIG",
    "botToken":      "Bot Token",
    "allowedUsers":  "Allowed User IDs (comma-separated)",
    "saveConfig":    "Save Config",
    "saved":         "Saved",
    "saveFailed":    "Save failed",
    "loadFailed":    "Failed to load config",
    "statusSection": "Gateway Status",
    "running":       "Running",
    "stopped":       "Stopped",
    "starting":      "Starting...",
    "stopping":      "Stopping...",
    "start":         "Start",
    "stop":          "Stop",
    "startFailed":   "Failed to start",
    "stopFailed":    "Failed to stop",
    "noTokenHint":   "Please save Bot Token first",
    "show":          "Show",
    "hide":          "Hide",
    "loading":       "Loading..."
  },
```

- [ ] **Step 6: 验证 JSON 合法**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
node -e "JSON.parse(require('fs').readFileSync('src/locales/zh/translation.json','utf8'))" && echo "zh OK"
node -e "JSON.parse(require('fs').readFileSync('src/locales/en/translation.json','utf8'))" && echo "en OK"
```

预期：`zh OK` 和 `en OK`。

- [ ] **Step 7: Commit**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
git add src/lib/tauri.ts \
        src/locales/zh/translation.json \
        src/locales/en/translation.json \
        src/__tests__/types/gateway-types.test.ts
git commit -m "feat: add gateway TypeScript bindings and i18n keys"
```

---

## Task 3: 前端组件 + 测试 + App 接线

**Files:**
- Create: `src/components/panels/GatewayPanel.tsx`
- Create: `src/__tests__/panels/GatewayPanel.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写 6 个失败测试**

新建 `src/__tests__/panels/GatewayPanel.test.tsx`：

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GatewayPanel } from "../../components/panels/GatewayPanel";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_gateway_config")
      return Promise.resolve({ botToken: "", allowedUsers: "" });
    if (cmd === "get_gateway_status")
      return Promise.resolve({ running: false });
    if (cmd === "save_gateway_config") return Promise.resolve();
    if (cmd === "start_gateway") return Promise.resolve();
    if (cmd === "stop_gateway") return Promise.resolve();
    return Promise.resolve();
  });
});

describe("GatewayPanel", () => {
  it("renders Telegram config section header", async () => {
    render(<GatewayPanel />);
    await waitFor(() =>
      expect(screen.getByText("gateway.section")).toBeInTheDocument()
    );
  });

  it("token input defaults to password type", async () => {
    render(<GatewayPanel />);
    await waitFor(() => screen.getByText("gateway.show"));
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs).toHaveLength(1);
  });

  it("clicking show button switches token to text type", async () => {
    render(<GatewayPanel />);
    await waitFor(() => screen.getByText("gateway.show"));
    await userEvent.click(screen.getByText("gateway.show"));
    const textInputs = document.querySelectorAll('input[type="text"]');
    // At least the token input is now text type
    expect(textInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("save button calls save_gateway_config", async () => {
    render(<GatewayPanel />);
    await waitFor(() => screen.getByText("gateway.saveConfig"));
    await userEvent.click(screen.getByText("gateway.saveConfig"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "save_gateway_config",
        expect.objectContaining({ botToken: "", allowedUsers: "" })
      )
    );
  });

  it("start button is disabled when token is empty", async () => {
    render(<GatewayPanel />);
    await waitFor(() => screen.getByText("gateway.start"));
    const startBtn = screen.getByText("gateway.start").closest("button");
    expect(startBtn).toBeDisabled();
  });

  it("start button triggers start_gateway when token is set", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_gateway_config")
        return Promise.resolve({ botToken: "test-token", allowedUsers: "" });
      if (cmd === "get_gateway_status")
        return Promise.resolve({ running: false });
      if (cmd === "start_gateway") return Promise.resolve();
      return Promise.resolve();
    });
    render(<GatewayPanel />);
    await waitFor(() => {
      const startBtn = screen.getByText("gateway.start").closest("button");
      expect(startBtn).not.toBeDisabled();
    });
    await userEvent.click(screen.getByText("gateway.start").closest("button")!);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("start_gateway")
    );
  });
});
```

- [ ] **Step 2: 运行测试，确认失败（GatewayPanel 不存在）**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npx vitest run src/__tests__/panels/GatewayPanel.test.tsx 2>&1 | tail -15
```

预期：FAIL，`Cannot find module '../../components/panels/GatewayPanel'`。

- [ ] **Step 3: 实现 `src/components/panels/GatewayPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands, GatewayConfig, GatewayStatus } from "../../lib/tauri";
import { useUIStore } from "../../store";

export function GatewayPanel() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();

  const [config, setConfig] = useState<GatewayConfig>({
    botToken: "",
    allowedUsers: "",
  });
  const [status, setStatus] = useState<GatewayStatus>({ running: false });
  const [showToken, setShowToken] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [actionLoading, setActionLoading] = useState<"start" | "stop" | null>(
    null
  );
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;

    Commands.getGatewayConfig()
      .then((c) => {
        if (active) setConfig(c);
      })
      .catch(() => {
        if (active) showToast(t("gateway.loadFailed"), "error");
      });

    Commands.getGatewayStatus()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => {});

    pollIntervalRef.current = setInterval(() => {
      Commands.getGatewayStatus()
        .then((s) => {
          if (active) setStatus(s);
        })
        .catch(() => {});
    }, 3000);

    return () => {
      active = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  // showToast and t are intentionally omitted: showToast is a stable Zustand selector,
  // t changes on language switch which should not re-fetch config.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  async function handleSave() {
    try {
      await Commands.saveGatewayConfig(config.botToken, config.allowedUsers);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setShowSaved(true);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("gateway.saveFailed")}: ${msg}`, "error");
    }
  }

  async function handleStart() {
    setActionLoading("start");
    try {
      await Commands.startGateway();
      // Wait 1.5s for hermes process to start before polling status
      setTimeout(() => {
        Commands.getGatewayStatus()
          .then((s) => {
            setStatus(s);
            if (!s.running) showToast(t("gateway.startFailed"), "error");
          })
          .catch(() => {})
          .finally(() => setActionLoading(null));
      }, 1500);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("gateway.startFailed")}: ${msg}`, "error");
      setActionLoading(null);
    }
  }

  async function handleStop() {
    setActionLoading("stop");
    try {
      await Commands.stopGateway();
      const s = await Commands.getGatewayStatus();
      setStatus(s);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("gateway.stopFailed")}: ${msg}`, "error");
    } finally {
      setActionLoading(null);
    }
  }

  const startDisabled =
    !config.botToken || actionLoading !== null || status.running;
  const stopDisabled = actionLoading !== null || !status.running;

  return (
    <div className="space-y-3">
      {/* Config card */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase">
            {t("gateway.section")}
          </div>
          <div className="h-5">
            {showSaved && (
              <span className="text-[12px] text-accent font-[600]">
                ✓ {t("gateway.saved")}
              </span>
            )}
          </div>
        </div>

        {/* Bot Token */}
        <div className="mb-3">
          <div className="text-[11px] text-text-primary font-[500] mb-1">
            {t("gateway.botToken")}
          </div>
          <div className="flex gap-2">
            <input
              type={showToken ? "text" : "password"}
              value={config.botToken}
              onChange={(e) =>
                setConfig({ ...config, botToken: e.target.value })
              }
              className="flex-1 bg-bg-secondary rounded-[8px] px-3 py-[7px] text-[11px] font-mono border border-border text-text-primary outline-none"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="bg-bg-secondary rounded-[8px] px-3 py-[7px] text-[11px] font-[500] border border-border text-text-primary whitespace-nowrap"
            >
              {showToken ? t("gateway.hide") : t("gateway.show")}
            </button>
          </div>
        </div>

        {/* Allowed Users */}
        <div className="mb-4">
          <div className="text-[11px] text-text-primary font-[500] mb-1">
            {t("gateway.allowedUsers")}
          </div>
          <input
            type="text"
            value={config.allowedUsers}
            onChange={(e) =>
              setConfig({ ...config, allowedUsers: e.target.value })
            }
            className="w-full bg-bg-secondary rounded-[8px] px-3 py-[7px] text-[11px] border border-border text-text-primary outline-none"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full bg-accent text-white text-[12px] font-[600] py-[9px] rounded-[9px]"
        >
          {t("gateway.saveConfig")}
        </button>
      </div>

      {/* Status + Controls card */}
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-1">
              {t("gateway.statusSection")}
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  status.running ? "bg-green-500" : "bg-orange-400"
                }`}
              />
              <span className="text-[13px] font-[600] text-text-primary">
                {actionLoading === "start"
                  ? t("gateway.starting")
                  : actionLoading === "stop"
                  ? t("gateway.stopping")
                  : status.running
                  ? t("gateway.running")
                  : t("gateway.stopped")}
              </span>
              {status.running && (
                <span className="text-[11px] text-text-secondary bg-bg-secondary px-[6px] py-[2px] rounded">
                  Telegram
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={startDisabled}
              title={!config.botToken ? t("gateway.noTokenHint") : undefined}
              className={`text-[12px] font-[600] px-4 py-[7px] rounded-[8px] ${
                startDisabled
                  ? "bg-bg-secondary text-text-tertiary"
                  : "bg-green-500 text-white"
              }`}
            >
              {actionLoading === "start" ? "..." : t("gateway.start")}
            </button>
            <button
              onClick={handleStop}
              disabled={stopDisabled}
              className={`text-[12px] font-[600] px-4 py-[7px] rounded-[8px] ${
                stopDisabled
                  ? "bg-bg-secondary text-text-tertiary"
                  : "bg-red-500 text-white"
              }`}
            >
              {actionLoading === "stop" ? "..." : t("gateway.stop")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试，验证 6 个测试全部通过**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npx vitest run src/__tests__/panels/GatewayPanel.test.tsx 2>&1
```

预期：6 个测试全部 PASS。若有失败，根据错误信息修复（常见：`closest("button")` 返回 null 时需改 `getByRole("button", { name: ... })`）。

- [ ] **Step 5: 接线 App.tsx**

将 `src/App.tsx` 中：

```tsx
import { ToolsPanel } from "./components/panels/ToolsPanel";
```

改为：

```tsx
import { ToolsPanel } from "./components/panels/ToolsPanel";
import { GatewayPanel } from "./components/panels/GatewayPanel";
```

将：

```tsx
          {(activePanel === "gateway" || activePanel === "migrate") && (
            <PlaceholderPanel />
          )}
```

改为：

```tsx
          {activePanel === "gateway" && <GatewayPanel />}
          {activePanel === "migrate" && <PlaceholderPanel />}
```

- [ ] **Step 6: TypeScript 类型检查**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npx tsc --noEmit 2>&1
```

预期：无错误（exit 0）。

- [ ] **Step 7: 运行全量前端测试，确保无回归**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npx vitest run 2>&1 | tail -15
```

预期：所有既有测试 + 6 个新 GatewayPanel 测试均通过，0 FAILED。

- [ ] **Step 8: Commit**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
git add src/components/panels/GatewayPanel.tsx \
        src/__tests__/panels/GatewayPanel.test.tsx \
        src/App.tsx
git commit -m "feat: add GatewayPanel component with start/stop/status polling"
```

---

## 自检（Spec Coverage）

| Spec 要求 | 对应 Task |
|-----------|----------|
| `~/.hermes/.env` 读写，保留其他字段 | Task 1 Step 3 (`save_gateway_config_to`) |
| `.env` 不存在时返回空字符串 | Task 1 Step 3 (`get_gateway_config_from`) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ALLOWED_USERS` | Task 1 Step 3 |
| 启动：spawn `hermes gateway run` detached | Task 1 Step 3 (`start_gateway`) |
| 停止：spawn `hermes gateway stop`，timeout 10s，fallback SIGTERM | Task 1 Step 3 (`stop_gateway`) |
| 状态：读 `gateway.pid` + 检查进程活跃 | Task 1 Step 3 (`get_gateway_status_from`) |
| 5 个 Tauri 命令注册 | Task 1 Step 5 |
| TypeScript `GatewayConfig` / `GatewayStatus` | Task 2 Step 2 |
| 5 个 TypeScript Commands | Task 2 Step 2 |
| 19 个 i18n 键（zh + en） | Task 2 Step 4–5 |
| Layout C（配置在上，状态+控制在下） | Task 3 Step 3 |
| Token 默认 password 类型，可切换显示 | Task 3 Step 3 |
| 保存后 ✓ badge 1.5s | Task 3 Step 3 |
| Token 为空时启动按钮 disabled + tooltip | Task 3 Step 3 |
| 启动后 1.5s 再轮询状态 | Task 3 Step 3 |
| 3s 轮询，卸载时清除 | Task 3 Step 3 |
| 5 个 Rust 单元测试 | Task 1 Step 3 |
| 6 个前端测试 | Task 3 Step 1 |
| App.tsx `gateway` 分支接线 | Task 3 Step 5 |
