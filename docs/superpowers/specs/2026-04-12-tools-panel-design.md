# Tools 面板设计文档

**日期**：2026-04-12
**状态**：已确认
**所属阶段**：Phase 2 — Tools

---

## 1. 概述

Tools 面板允许用户通过 GUI 管理 hermes-agent CLI 的工具开关，即 `~/.hermes/cli-config.yaml` 中 `platform_toolsets.cli` 字段的内容。用户拨动开关即时保存，无需额外点击 Save 按钮。

---

## 2. 配置文件

| 属性 | 值 |
|------|----|
| 文件路径 | `~/.hermes/cli-config.yaml` |
| 目标字段 | `platform_toolsets.cli`（`Vec<String>`） |
| 默认值 | 文件不存在或字段缺失时视为全部工具启用 |
| 其他字段 | 读写时原样保留，不修改 |

**格式示例：**
```yaml
platform_toolsets:
  cli: [terminal, file, web, memory, skills, todo, cronjob]
```

---

## 3. 工具分组

### 核心工具（默认全开）

| Toolset | 中文名 | 说明 |
|---------|--------|------|
| `terminal` | 终端执行 | 运行命令、管理进程 |
| `file` | 文件操作 | 读写、搜索本地文件 |
| `web` | 网页搜索 | 搜索 + 内容提取 |
| `memory` | 持久记忆 | 跨会话保存用户偏好 |
| `skills` | 技能库 | 加载 skill 文档 |
| `todo` | 任务规划 | 多步骤任务追踪 |
| `cronjob` | 定时任务 | 创建/管理计划任务 |

### 可选工具（按需开启）

| Toolset | 中文名 | 说明 |
|---------|--------|------|
| `browser` | 浏览器自动化 | 需要 `BROWSERBASE_API_KEY` |
| `vision` | 图像分析 | 需要 `OPENROUTER_API_KEY` |
| `image_gen` | 图像生成 | 需要 `FAL_KEY` |
| `tts` | 语音合成 | Edge TTS 免费；付费 provider 需 API Key |
| `moa` | 多模型推理 | Mixture of Agents，需要 `OPENROUTER_API_KEY` |

---

## 4. 数据流

```
用户拨动 Toggle
  → 前端更新本地 activeToolsets 状态（乐观更新）
  → invoke("save_tools", { toolsets: [...] })
  → Rust: 读取 cli-config.yaml（不存在则创建空文件）
  → 用 serde_yaml::Value 替换 platform_toolsets.cli
  → 写回磁盘
  → Ok  → 右上角短暂显示 "✓ 已保存" badge（1.5s 后消失）
  → Err → toast 报错，本地状态回滚
```

**默认值逻辑**：`get_tools` 若文件不存在或 `platform_toolsets.cli` 未设置，返回全部已知 toolset 列表（视为全部启用）。

---

## 5. Rust 后端

### 新文件：`src-tauri/src/commands/tools.rs`

```rust
// 已知 toolset 常量列表（核心 + 可选）
const ALL_KNOWN_TOOLSETS: &[&str] = &[
    "terminal", "file", "web", "memory", "skills", "todo", "cronjob",
    "browser", "vision", "image_gen", "tts", "moa",
];

// 读取 ~/.hermes/cli-config.yaml 中 platform_toolsets.cli
// 文件不存在或字段缺失 → 返回 ALL_KNOWN_TOOLSETS
#[tauri::command]
pub async fn get_tools() -> Result<Vec<String>, String>

// 只替换 platform_toolsets.cli，其他字段保留
// 使用 serde_yaml::Value 动态操作，避免丢失未知字段
#[tauri::command]
pub async fn save_tools(toolsets: Vec<String>) -> Result<(), String>
```

**路径**：`dirs::home_dir().join(".hermes/cli-config.yaml")`

### 修改：`src-tauri/src/commands/mod.rs`
追加 `pub mod tools;`

### 修改：`src-tauri/src/lib.rs`
在 `invoke_handler!` 中追加 `tools::get_tools, tools::save_tools`

---

## 6. TypeScript 绑定

追加到 `src/lib/tauri.ts` 的 `Commands` 对象：

```typescript
getTools: (): Promise<string[]> =>
  tauriInvoke("get_tools"),

saveTools: (toolsets: string[]): Promise<void> =>
  tauriInvoke("save_tools", { toolsets }),
```

---

## 7. 前端组件

### 新文件：`src/components/panels/ToolsPanel.tsx`

**结构：**
- `useEffect` 挂载时调用 `Commands.getTools()` 获取激活列表
- 本地状态 `activeToolsets: Set<string>`
- 每次 Toggle 变更：更新本地状态 → 调用 `Commands.saveTools([...activeToolsets])` → 成功显示 saved badge，失败 toast + 回滚
- `savedBadge` 状态：保存成功后显示 1.5s 的 "✓ 已保存" / "✓ Saved" badge，然后自动隐藏

**布局：**
```
┌─────────────────────────────────────────────┐
│ 核心工具                        ✓ 已保存     │  ← header + saved badge
├─────────────────────────────────────────────┤
│ 终端执行    运行命令、管理进程    [Toggle]   │
│ 文件操作    读写、搜索本地文件    [Toggle]   │
│ ...                                          │
├─────────────────────────────────────────────┤
│ 可选工具                                     │
├─────────────────────────────────────────────┤
│ 浏览器自动化  需要 BROWSERBASE_API_KEY [T]  │
│ ...                                          │
└─────────────────────────────────────────────┘
```

每行为白色卡片内的 iOS Toggle 行，使用现有 `Toggle` 组件。两个分组各自在独立的白色圆角卡片中，与 ConfigPanel 的行为卡片样式一致。

### 修改：`src/App.tsx`
将 `<PlaceholderPanel />` 的 `tools` 分支替换为 `<ToolsPanel />`。

---

## 8. i18n

新增翻译键（同时加入 `zh/translation.json` 和 `en/translation.json`）：

```json
"tools": {
  "coreSection": "核心工具",
  "optionalSection": "可选工具",
  "saved": "已保存",
  "saveFailed": "保存失败：",
  "terminal":  { "label": "终端执行",   "desc": "运行命令、管理进程" },
  "file":      { "label": "文件操作",   "desc": "读写、搜索本地文件" },
  "web":       { "label": "网页搜索",   "desc": "搜索 + 内容提取" },
  "memory":    { "label": "持久记忆",   "desc": "跨会话保存用户偏好" },
  "skills":    { "label": "技能库",     "desc": "加载 skill 文档" },
  "todo":      { "label": "任务规划",   "desc": "多步骤任务追踪" },
  "cronjob":   { "label": "定时任务",   "desc": "创建/管理计划任务" },
  "browser":   { "label": "浏览器自动化","desc": "需要 BROWSERBASE_API_KEY" },
  "vision":    { "label": "图像分析",   "desc": "需要 OPENROUTER_API_KEY" },
  "image_gen": { "label": "图像生成",   "desc": "需要 FAL_KEY" },
  "tts":       { "label": "语音合成",   "desc": "Edge TTS 免费；付费 provider 需 API Key" },
  "moa":       { "label": "多模型推理", "desc": "Mixture of Agents，需要 OPENROUTER_API_KEY" }
}
```

---

## 9. 测试

### Rust（`tools.rs` 内 `#[cfg(test)]`）
- `test_get_tools_missing_file_returns_all_defaults` — 文件不存在时返回全量 toolset
- `test_get_tools_reads_existing_config` — 正确解析已有 `platform_toolsets.cli`
- `test_save_tools_preserves_other_fields` — 保存后 `model`、`agent` 等字段不丢失
- `test_save_tools_creates_file_if_missing` — 文件不存在时自动创建

### 前端（`src/__tests__/panels/ToolsPanel.test.tsx`）
- 渲染核心工具分组标题
- 渲染所有 12 个工具的 Toggle
- Toggle 变更触发 `save_tools` invoke
- 保存失败时显示 toast 并回滚状态

---

## 10. 范围边界

**本次做：**
- CLI platform toolsets 的读写 UI
- 12 个已知 toolset 的 Toggle 管理

**不做（YAGNI）：**
- 其他平台（telegram/discord）的 toolset 配置（归 Gateway 面板）
- 工具间依赖校验（如 moa 依赖 openrouter）
- toolset 详细文档或帮助链接
- 新 toolset 的自动发现（硬编码 12 个）
