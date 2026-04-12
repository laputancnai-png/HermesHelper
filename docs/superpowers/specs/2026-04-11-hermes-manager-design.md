# Hermes Manager — 设计文档

**日期**：2026-04-11  
**状态**：已确认  
**参考**：[hermes-agent](https://github.com/nousresearch/hermes-agent) · [UI 原型](../../hermes-manager-ui.html)

---

## 1. 项目概述

Hermes Manager 是 [Nous Research Hermes Agent](https://github.com/nousresearch/hermes-agent) 的桌面 GUI 管理工具。它引导用户完成 hermes-agent 的安装，并提供配置、工具管理、消息网关、数据迁移等功能的可视化界面。

**目标用户**：需要使用 Hermes Agent 但不熟悉命令行的用户，以及希望用 GUI 管理已有安装的用户。

---

## 2. 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | React + TypeScript | React 18 / TS 5 |
| 构建工具 | Vite | 5.x |
| 样式 | Tailwind CSS（沿用原型设计 token） | 3.x |
| 状态管理 | Zustand | 4.x |
| 桌面框架 | Tauri | 2.x |
| 后端语言 | Rust | stable |
| 配置解析 | serde_yaml | latest |
| 打包 | tauri-action（GitHub Actions） | latest |

**选型理由**：Tauri 安装包体积约 8-15 MB（vs Electron 100+ MB），原生支持三平台打包（.dmg / .exe / .AppImage），前端复用 HTML 原型设计语言，Rust 后端处理子进程和文件 I/O 足够。

---

## 3. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      Tauri App                          │
│                                                         │
│  ┌──────────────────────┐    ┌────────────────────────┐ │
│  │  React Frontend      │◄──►│  Rust Backend          │ │
│  │                      │    │                        │ │
│  │  • 6 个面板组件       │    │  commands/             │ │
│  │  • Zustand 状态管理   │    │    installer.rs        │ │
│  │  • lib/tauri.ts 封装  │    │    config.rs           │ │
│  │  • Tailwind UI        │    │    process.rs          │ │
│  └──────────────────────┘    │    migrate.rs          │ │
│                               └──────────┬─────────────┘ │
└──────────────────────────────────────────┼───────────────┘
                                           │ subprocess
                                ┌──────────▼──────────────┐
                                │   hermes-agent (Python) │
                                │   ~/.hermes/            │
                                │   config.yaml + .env    │
                                └─────────────────────────┘
```

**通信方式**：
- 前端 → 后端：`invoke(command, args)` 异步调用
- 后端 → 前端（实时）：`emit(event, payload)` 事件流
- 后端 → hermes-agent：`std::process::Command` 子进程

---

## 4. 目录结构

```
hermes-manager/
├── src/                          # React 前端
│   ├── components/
│   │   ├── panels/               # 6 个面板组件
│   │   │   ├── HomePanel.tsx
│   │   │   ├── InstallPanel.tsx
│   │   │   ├── ConfigPanel.tsx
│   │   │   ├── ToolsPanel.tsx
│   │   │   ├── GatewayPanel.tsx
│   │   │   └── MigratePanel.tsx
│   │   ├── ui/                   # Button, Toggle, Badge, Toast…
│   │   └── layout/               # Sidebar, Topbar
│   ├── hooks/                    # useHermes, useConfig, useGateway…
│   ├── store/                    # Zustand slices
│   │   ├── hermesSlice.ts
│   │   ├── configSlice.ts
│   │   ├── gatewaySlice.ts
│   │   └── uiSlice.ts
│   ├── lib/
│   │   └── tauri.ts              # 统一 invoke/listen 封装 + 类型定义
│   └── App.tsx
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── commands/
│   │   │   ├── installer.rs
│   │   │   ├── config.rs
│   │   │   ├── process.rs
│   │   │   └── migrate.rs
│   │   ├── main.rs
│   │   └── lib.rs                # 注册所有 commands
│   ├── Cargo.toml
│   └── tauri.conf.json
└── .github/
    └── workflows/
        └── release.yml           # tauri-action 三平台打包
```

---

## 5. 面板功能

### 5.1 Home（总览）
- 状态卡片：安装状态、版本号、活跃记忆数
- Doctor 诊断：点击触发 `invoke("run_doctor")`，渲染每行结果（✓/✗/ℹ）
- 统计：pass / warn / fail 计数
- 快速操作：跳转 Install / Config / Migrate 面板
- 最近活动日志（从本地日志文件读取）

### 5.2 Install（安装 / 更新）
- 4 步向导：平台检测 → 选择模式 → 配置 API Key → 验证
- 安装模式：完整（推荐）/ 仅核心 / 含 Voice
- 实时进度条 + 日志流（Tauri Events）
- 卸载按钮（带二次确认）

### 5.3 Config（基础配置）
- LLM 提供商：OpenRouter / Gemini / OpenAI / Anthropic / 自定义
- 默认模型下拉选择
- API Key：写入 `~/.hermes/.env`（不进 config.yaml）
- 测试连接按钮
- 终端沙箱：执行后端选择（local / Docker / SSH / Modal）
- 行为开关：持久记忆 / 自动生成技能 / 命令审批模式 / 预算压力提示
- 保存所有配置按钮

### 5.4 Tools（工具开关）
- 核心工具 toggle：Terminal / 文件系统 / Web 搜索 / Python REPL
- 可选工具 toggle：语音输入 / 浏览器自动化 / Cron / MCP 集成
- 开关状态写入 config.yaml tools 字段

### 5.5 Gateway（消息网关）
- 支持平台：Telegram / Discord / Slack / WhatsApp（实验性）/ Signal / Email
- 各平台独立配置区（Token、Chat ID 等）
- 启动 / 停止网关进程（`process.rs`）
- 状态指示（运行中 / 未启动）

### 5.6 Migrate（导入 / 导出）
- 可选数据项：配置 / 记忆 / 技能库 / 会话历史 / Cron / Hooks
- 导出 .zip（含/不含明文 API Key 开关）
- 拖拽导入 .zip 恢复
- 定时备份（Phase 3）

---

## 6. 关键数据流

### 安装流程（实时流）
```
用户点击「开始安装」
  → invoke("install_hermes", { mode })
  → Rust: spawn curl | bash
  → 逐行读取 stdout → emit("install_progress", { line, pct })
  → 前端 listen("install_progress") → 更新进度条 + 日志
  → exit code = 0 → emit("install_done") → 跳转 Home
```

### 配置读写（按需）
```
面板加载 → invoke("get_config") → Rust 读 config.yaml → 返回 ConfigState → 填充表单
点击保存 → invoke("save_config", { data }) → Rust 校验 → 写磁盘 → Ok/Err → toast
API Key  → invoke("save_api_key", { key }) → 写 ~/.hermes/.env（独立）
```

### Doctor 诊断（非流式）
```
点击触发 → invoke("run_doctor")
  → Rust spawn hermes doctor → 等待 exit
  → 解析每行 stdout → 返回 DoctorResult[]
  → 前端渲染 ✓/✗/ℹ 行 + 统计徽章
```

---

## 7. 错误处理

| 层 | 策略 |
|----|------|
| Rust | 统一返回 `Result<T, String>`，不 panic，错误转字符串上抛 |
| 前端 invoke | `try/catch` 包裹所有调用，catch → toast 显示错误信息 |
| 安装失败 | 保留日志，显示「重试」按钮，不删已有安装 |
| 配置校验 | Rust 层校验字段合法性，返回字段级错误信息 |

---

## 8. 测试策略

### Rust 单元测试（`cargo test`）
- `config.rs`：yaml 解析/序列化正确性
- `migrate.rs`：zip 打包/解压逻辑
- `installer.rs`：版本号解析、平台检测
- 不依赖外部进程或网络

### React 组件测试（Vitest + Testing Library）
- mock `@tauri-apps/api` 模块
- 测试表单校验、状态更新、toast 触发
- 无需启动真实 Tauri 进程

### E2E 测试（WebDriver + tauri-driver）
- 面板切换、表单保存、toast 出现
- 仅在 CI Linux runner 上运行
- 不测安装流程（避免网络 + hermes-agent 依赖）

---

## 9. CI/CD

### PR 检查（push → main）
1. `cargo test`（Rust 单元测试）
2. `vitest run`（React 组件测试）
3. `cargo clippy`（Rust lint）
4. ESLint + TypeScript 类型检查

### Release（push tag `v*.*.*`）
1. tauri-action 矩阵构建（macOS-latest / windows-latest / ubuntu-latest）
2. 上传 artifacts 到 GitHub Release
3. 自动生成 Release Notes

---

## 10. MVP 范围

### Phase 1（MVP）
- [x] Home：Doctor + 状态卡片 + 活动日志
- [x] Install：完整向导 + 实时进度
- [x] Config：LLM + API Key + 行为开关
- [x] 系统托盘图标
- [x] GitHub Actions 三平台打包

### Phase 2
- [ ] Tools：工具开关面板
- [ ] Gateway：Telegram / Discord 配置 + 启停
- [ ] Migrate：手动导出/导入 .zip

### Phase 3（暂不做）
- [ ] 定时自动备份
- [ ] WhatsApp / Signal（实验性）
- [ ] 沙箱后端切换（Docker / SSH / Modal）
