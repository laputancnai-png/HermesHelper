# Gateway 面板设计文档

**日期**：2026-04-15
**状态**：已确认
**所属阶段**：Phase 2B — Gateway

---

## 1. 概述

Gateway 面板允许用户配置 Telegram Bot Token 与允许用户列表，并通过 GUI 启动 / 停止 hermes-agent 的 gateway 进程。配置写入 `~/.hermes/.env`，进程通过 `hermes gateway run / stop` CLI 命令管理，状态通过 `~/.hermes/gateway.pid` 检测。

本阶段仅支持 Telegram 平台。

---

## 2. 配置文件

| 属性 | 值 |
|------|----|
| 文件路径 | `~/.hermes/.env` |
| 目标字段 | `TELEGRAM_BOT_TOKEN`、`TELEGRAM_ALLOWED_USERS` |
| 默认值 | 文件不存在或字段缺失时返回空字符串 |
| 其他字段 | 读写时原样保留，不修改 |

**格式示例：**
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ALLOWED_USERS=123456789,987654321
```

---

## 3. 进程管理

| 操作 | 实现 |
|------|------|
| 启动 | spawn `hermes gateway run`（detached，不阻塞 UI）|
| 停止 | spawn `hermes gateway stop`，等待退出；若失败则读 `~/.hermes/gateway.pid` 发 SIGTERM |
| 状态检测 | 读取 `~/.hermes/gateway.pid`，检查 PID 是否存活 |
| 轮询间隔 | 面板挂载后每 3s 调用 `get_gateway_status()`，卸载时清除定时器 |

---

## 4. 数据流

```
用户保存配置
  → invoke("save_gateway_config", { botToken, allowedUsers })
  → Rust: 读取 ~/.hermes/.env（不存在则创建）
  → 替换 TELEGRAM_BOT_TOKEN / TELEGRAM_ALLOWED_USERS，保留其他行
  → 写回磁盘
  → Ok → 右上角显示 "✓ 已保存" badge（1.5s）
  → Err → toast 报错

用户点击「启动」
  → invoke("start_gateway")
  → Rust: spawn hermes gateway run（detached）
  → 返回 Ok（不等待进程）
  → 前端：按钮 loading → 1.5s 后轮询状态更新 UI
  → 若状态仍 stopped → toast 报错

用户点击「停止」
  → invoke("stop_gateway")
  → Rust: spawn hermes gateway stop，等待退出（timeout 10s）
  → 若超时则读 gateway.pid 发 SIGTERM
  → 返回 Ok/Err
  → 前端：按钮 loading → 更新状态
```

**状态轮询**：`get_gateway_status()` 读取 `~/.hermes/gateway.pid`，若文件存在则检查进程是否活跃，返回 `GatewayStatus { running: bool }`。

---

## 5. Rust 后端

### 新文件：`src-tauri/src/commands/gateway.rs`

```rust
// 数据结构
pub struct GatewayConfig {
    pub bot_token: String,
    pub allowed_users: String,  // 逗号分隔，原样存取
}

pub struct GatewayStatus {
    pub running: bool,
}

// 可测试辅助函数
pub(crate) fn get_gateway_config_from(env_path: &Path) -> Result<GatewayConfig, String>
pub(crate) fn save_gateway_config_to(env_path: &Path, config: &GatewayConfig) -> Result<(), String>
pub(crate) fn get_gateway_status_from(pid_path: &Path) -> GatewayStatus

// Tauri 命令
#[tauri::command] pub async fn get_gateway_config() -> Result<GatewayConfig, String>
#[tauri::command] pub async fn save_gateway_config(bot_token: String, allowed_users: String) -> Result<(), String>
#[tauri::command] pub async fn get_gateway_status() -> GatewayStatus
#[tauri::command] pub async fn start_gateway() -> Result<(), String>
#[tauri::command] pub async fn stop_gateway() -> Result<(), String>
```

**路径：**
- `.env`：`dirs::home_dir().join(".hermes/.env")`
- `gateway.pid`：`dirs::home_dir().join(".hermes/gateway.pid")`

### 修改：`src-tauri/src/commands/mod.rs`
追加 `pub mod gateway;`

### 修改：`src-tauri/src/lib.rs`
在 `use commands::{...}` 追加 `gateway`，在 `invoke_handler!` 追加 5 个命令。

---

## 6. TypeScript 绑定

追加到 `src/lib/tauri.ts`：

```typescript
export interface GatewayConfig {
  botToken: string;
  allowedUsers: string;
}

export interface GatewayStatus {
  running: boolean;
}

// 追加到 Commands 对象
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

---

## 7. 前端组件

### 新文件：`src/components/panels/GatewayPanel.tsx`

**布局（Layout C — 配置在上，状态在下）：**
```
┌─────────────────────────────────────────────┐
│ TELEGRAM 配置                   ✓ 已保存    │  ← saved badge
├─────────────────────────────────────────────┤
│ Bot Token        [••••••••••••••] [显示]    │
│ 允许的用户 ID    [123, 456     ]            │
│                  [ 保存配置  ]              │
├─────────────────────────────────────────────┤
│ 网关状态                                    │
│ ● 未运行              [启动]  [停止(灰)]   │
└─────────────────────────────────────────────┘
```

**状态：**
- `config: GatewayConfig` — 配置表单值
- `status: GatewayStatus` — `{ running: false }` 初始
- `showToken: boolean` — Token 显示/隐藏
- `showSaved: boolean` — 保存成功 badge
- `actionLoading: 'start' | 'stop' | null` — 按钮 loading 状态
- `pollIntervalRef` — 3s 轮询定时器引用

**交互规则：**
- Token 为空时「启动」按钮 disabled，tooltip "请先保存 Bot Token"
- 启动/停止时对应按钮显示 loading spinner，另一个置灰
- 运行中时「启动」置灰，「停止」高亮红色；反之亦然
- 启动后等待 1.5s 再触发状态刷新（给 hermes 进程启动时间）
- 卸载时清除轮询定时器

### 修改：`src/App.tsx`
将 `gateway` 分支从 `PlaceholderPanel` 改为 `<GatewayPanel />`。

---

## 8. i18n

新增翻译键（zh/en 各加 `gateway` 块）：

```json
"gateway": {
  "section":       "Telegram 配置",
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
}
```

---

## 9. 测试

### Rust（`gateway.rs` 内 `#[cfg(test)]`）
- `test_get_config_missing_file_returns_empty` — `.env` 不存在时返回空 token
- `test_get_config_reads_token_from_env` — 正确解析 `TELEGRAM_BOT_TOKEN`
- `test_save_config_preserves_other_fields` — 保存后其他 env 变量不丢失
- `test_save_config_creates_file_if_missing` — 文件不存在时自动创建
- `test_get_status_no_pid_file_returns_not_running` — `gateway.pid` 不存在时返回 `running: false`

### 前端（`src/__tests__/panels/GatewayPanel.test.tsx`）
- 渲染 Telegram 配置区标题
- Token 输入框默认 password 类型
- 点击「显示」切换为 text 类型
- 保存调用 `save_gateway_config`
- Token 为空时「启动」按钮 disabled
- 点击启动触发 `start_gateway`

---

## 10. 范围边界

**本次做：**
- Telegram 单平台配置（BOT_TOKEN + ALLOWED_USERS）
- Gateway 进程启动 / 停止 / 状态轮询

**不做（YAGNI）：**
- Discord / Slack / WhatsApp 等其他平台（归未来迭代）
- Webhook 模式配置（`TELEGRAM_WEBHOOK_URL`）
- Gateway 日志流实时展示
- `platform_toolsets.telegram` 的工具开关（归 Tools 面板扩展）
- 开机自启 / systemd / launchd 服务管理
