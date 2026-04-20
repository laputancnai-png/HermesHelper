# Tools 面板实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Tools 面板，让用户通过 iOS 风格 Toggle 管理 `~/.hermes/cli-config.yaml` 中 `platform_toolsets.cli` 的工具开关，拨动即时保存。

**Architecture:** 新建 Rust 命令模块 `tools.rs` 负责读写 `cli-config.yaml`，使用 `serde_yaml::Value` 动态操作以保留文件中的其他字段；TypeScript 新增两个绑定；前端 `ToolsPanel.tsx` 乐观更新 + 失败回滚，无需 Save 按钮。

**Tech Stack:** Rust + serde_yaml 0.9, React 18 + TypeScript, react-i18next, Tailwind CSS v4, Vitest + @testing-library/react

**Worktree:** `/Users/laputancnai/HermesHelper/.worktrees/feature/phase1/`

**Spec:** `docs/superpowers/specs/2026-04-12-tools-panel-design.md`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src-tauri/src/commands/tools.rs` | `get_tools` / `save_tools` 命令 |
| Modify | `src-tauri/src/commands/mod.rs` | 追加 `pub mod tools;` |
| Modify | `src-tauri/src/lib.rs` | 注册两个新命令 |
| Modify | `src/lib/tauri.ts` | 追加 `getTools` / `saveTools` 绑定 |
| Modify | `src/locales/zh/translation.json` | 追加 `tools.*` 中文翻译 |
| Modify | `src/locales/en/translation.json` | 追加 `tools.*` 英文翻译 |
| Create | `src/components/panels/ToolsPanel.tsx` | Tools 面板组件 |
| Modify | `src/App.tsx` | 将 tools 分支从 PlaceholderPanel 改为 ToolsPanel |
| Create | `src/__tests__/panels/ToolsPanel.test.tsx` | 前端单元测试 |

---

## Task 1: Rust tools.rs 命令模块（TDD）

**Files:**
- Create: `src-tauri/src/commands/tools.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写失败测试**

在 worktree 根目录下创建 `src-tauri/src/commands/tools.rs`，先只写测试模块：

```rust
const ALL_KNOWN_TOOLSETS: &[&str] = &[
    "terminal", "file", "web", "memory", "skills", "todo", "cronjob",
    "browser", "vision", "image_gen", "tts", "moa",
];

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_get_tools_missing_file_returns_all_defaults() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        let result = get_tools_from(&path).unwrap();
        assert_eq!(result.len(), ALL_KNOWN_TOOLSETS.len());
        assert!(result.contains(&"terminal".to_string()));
        assert!(result.contains(&"browser".to_string()));
    }

    #[test]
    fn test_get_tools_reads_existing_config() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        std::fs::write(&path, "platform_toolsets:\n  cli: [terminal, file, web]\n").unwrap();
        let result = get_tools_from(&path).unwrap();
        assert_eq!(result, vec!["terminal", "file", "web"]);
    }

    #[test]
    fn test_get_tools_missing_field_returns_all_defaults() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        std::fs::write(&path, "model:\n  default: claude-opus\n").unwrap();
        let result = get_tools_from(&path).unwrap();
        assert_eq!(result.len(), ALL_KNOWN_TOOLSETS.len());
    }

    #[test]
    fn test_save_tools_creates_file_if_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        save_tools_to(&path, &["terminal".to_string(), "web".to_string()]).unwrap();
        assert!(path.exists());
        let loaded = get_tools_from(&path).unwrap();
        assert_eq!(loaded, vec!["terminal", "web"]);
    }

    #[test]
    fn test_save_tools_preserves_other_fields() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        std::fs::write(
            &path,
            "model:\n  default: claude-opus\nplatform_toolsets:\n  cli: [terminal]\n",
        )
        .unwrap();
        save_tools_to(&path, &["terminal".to_string(), "file".to_string()]).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("claude-opus"), "model field must be preserved");
        let loaded = get_tools_from(&path).unwrap();
        assert_eq!(loaded, vec!["terminal", "file"]);
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1/src-tauri
cargo test commands::tools 2>&1 | head -20
```

Expected: compilation error — `get_tools_from` and `save_tools_to` not found.

- [ ] **Step 3: 实现 tools.rs 完整内容**

将 `src-tauri/src/commands/tools.rs` 替换为完整实现：

```rust
use std::path::{Path, PathBuf};

fn cli_config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".hermes")
        .join("cli-config.yaml")
}

pub(crate) const ALL_KNOWN_TOOLSETS: &[&str] = &[
    "terminal", "file", "web", "memory", "skills", "todo", "cronjob",
    "browser", "vision", "image_gen", "tts", "moa",
];

pub(crate) fn get_tools_from(path: &Path) -> Result<Vec<String>, String> {
    if !path.exists() {
        return Ok(ALL_KNOWN_TOOLSETS.iter().map(|s| s.to_string()).collect());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read cli-config.yaml: {e}"))?;
    let value: serde_yaml::Value = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse cli-config.yaml: {e}"))?;

    match value
        .get("platform_toolsets")
        .and_then(|v| v.get("cli"))
        .and_then(|v| v.as_sequence())
    {
        None => Ok(ALL_KNOWN_TOOLSETS.iter().map(|s| s.to_string()).collect()),
        Some(seq) => Ok(seq
            .iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect()),
    }
}

pub(crate) fn save_tools_to(path: &Path, toolsets: &[String]) -> Result<(), String> {
    let mut value: serde_yaml::Value = if path.exists() {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read cli-config.yaml: {e}"))?;
        serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse cli-config.yaml: {e}"))?
    } else {
        serde_yaml::Value::Mapping(serde_yaml::Mapping::new())
    };

    if value.get("platform_toolsets").is_none() {
        value["platform_toolsets"] = serde_yaml::Value::Mapping(serde_yaml::Mapping::new());
    }

    value["platform_toolsets"]["cli"] = serde_yaml::Value::Sequence(
        toolsets
            .iter()
            .map(|s| serde_yaml::Value::String(s.clone()))
            .collect(),
    );

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    let content = serde_yaml::to_string(&value)
        .map_err(|e| format!("Failed to serialize: {e}"))?;
    std::fs::write(path, content)
        .map_err(|e| format!("Failed to write cli-config.yaml: {e}"))
}

#[tauri::command]
pub async fn get_tools() -> Result<Vec<String>, String> {
    get_tools_from(&cli_config_path())
}

#[tauri::command]
pub async fn save_tools(toolsets: Vec<String>) -> Result<(), String> {
    save_tools_to(&cli_config_path(), &toolsets)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_get_tools_missing_file_returns_all_defaults() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        let result = get_tools_from(&path).unwrap();
        assert_eq!(result.len(), ALL_KNOWN_TOOLSETS.len());
        assert!(result.contains(&"terminal".to_string()));
        assert!(result.contains(&"browser".to_string()));
    }

    #[test]
    fn test_get_tools_reads_existing_config() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        std::fs::write(&path, "platform_toolsets:\n  cli: [terminal, file, web]\n").unwrap();
        let result = get_tools_from(&path).unwrap();
        assert_eq!(result, vec!["terminal", "file", "web"]);
    }

    #[test]
    fn test_get_tools_missing_field_returns_all_defaults() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        std::fs::write(&path, "model:\n  default: claude-opus\n").unwrap();
        let result = get_tools_from(&path).unwrap();
        assert_eq!(result.len(), ALL_KNOWN_TOOLSETS.len());
    }

    #[test]
    fn test_save_tools_creates_file_if_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        save_tools_to(&path, &["terminal".to_string(), "web".to_string()]).unwrap();
        assert!(path.exists());
        let loaded = get_tools_from(&path).unwrap();
        assert_eq!(loaded, vec!["terminal", "web"]);
    }

    #[test]
    fn test_save_tools_preserves_other_fields() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cli-config.yaml");
        std::fs::write(
            &path,
            "model:\n  default: claude-opus\nplatform_toolsets:\n  cli: [terminal]\n",
        )
        .unwrap();
        save_tools_to(&path, &["terminal".to_string(), "file".to_string()]).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("claude-opus"), "model field must be preserved");
        let loaded = get_tools_from(&path).unwrap();
        assert_eq!(loaded, vec!["terminal", "file"]);
    }
}
```

- [ ] **Step 4: 注册模块 — 修改 `src-tauri/src/commands/mod.rs`**

```rust
pub mod config;
pub mod installer;
pub mod process;
pub mod tools;
```

- [ ] **Step 5: 注册命令 — 修改 `src-tauri/src/lib.rs`**

在 `use commands::{config, installer, process};` 这行改为：
```rust
use commands::{config, installer, process, tools};
```

在 `invoke_handler!` 宏中追加两行（放在 `process::get_recent_activity,` 之后）：
```rust
            tools::get_tools,
            tools::save_tools,
```

- [ ] **Step 6: 运行 Rust 测试确认通过**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1/src-tauri
cargo test 2>&1 | grep -E "test .* ok|FAILED|error\[" | head -20
```

Expected: 全部 15 个测试通过（原 10 个 + 新增 5 个），0 FAILED。

- [ ] **Step 7: 提交**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
git add src-tauri/src/commands/tools.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add get_tools and save_tools Rust commands for cli-config.yaml"
```

---

## Task 2: TypeScript 绑定 + i18n 翻译

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/locales/zh/translation.json`
- Modify: `src/locales/en/translation.json`

- [ ] **Step 1: 追加 TypeScript 绑定到 `src/lib/tauri.ts`**

在 `Commands` 对象的最后一个方法（`getSystemLocale`）后追加：

```typescript
  getTools: (): Promise<string[]> =>
    tauriInvoke("get_tools"),

  saveTools: (toolsets: string[]): Promise<void> =>
    tauriInvoke("save_tools", { toolsets }),
```

- [ ] **Step 2: 追加中文翻译到 `src/locales/zh/translation.json`**

在最外层 JSON 对象的最后一个字段（`"toast"` 块）之前插入：

```json
  "tools": {
    "coreSection": "核心工具",
    "optionalSection": "可选工具",
    "saved": "已保存",
    "loadFailed": "工具配置加载失败",
    "saveFailed": "保存失败",
    "terminal":  { "label": "终端执行",      "desc": "运行命令、管理进程" },
    "file":      { "label": "文件操作",      "desc": "读写、搜索本地文件" },
    "web":       { "label": "网页搜索",      "desc": "搜索 + 内容提取" },
    "memory":    { "label": "持久记忆",      "desc": "跨会话保存用户偏好" },
    "skills":    { "label": "技能库",        "desc": "加载 skill 文档" },
    "todo":      { "label": "任务规划",      "desc": "多步骤任务追踪" },
    "cronjob":   { "label": "定时任务",      "desc": "创建/管理计划任务" },
    "browser":   { "label": "浏览器自动化",  "desc": "需要 BROWSERBASE_API_KEY" },
    "vision":    { "label": "图像分析",      "desc": "需要 OPENROUTER_API_KEY" },
    "image_gen": { "label": "图像生成",      "desc": "需要 FAL_KEY" },
    "tts":       { "label": "语音合成",      "desc": "Edge TTS 免费；付费 provider 需 API Key" },
    "moa":       { "label": "多模型推理",    "desc": "Mixture of Agents，需要 OPENROUTER_API_KEY" }
  },
```

- [ ] **Step 3: 追加英文翻译到 `src/locales/en/translation.json`**

在 `"toast"` 块之前同样插入：

```json
  "tools": {
    "coreSection": "Core Tools",
    "optionalSection": "Optional Tools",
    "saved": "Saved",
    "loadFailed": "Failed to load tool config",
    "saveFailed": "Save failed",
    "terminal":  { "label": "Terminal",             "desc": "Run commands and manage processes" },
    "file":      { "label": "File Operations",      "desc": "Read, write, and search local files" },
    "web":       { "label": "Web Search",           "desc": "Search the web and extract content" },
    "memory":    { "label": "Persistent Memory",    "desc": "Save user preferences across sessions" },
    "skills":    { "label": "Skills Library",       "desc": "Load skill documents" },
    "todo":      { "label": "Task Planning",        "desc": "Multi-step task tracking" },
    "cronjob":   { "label": "Scheduled Tasks",      "desc": "Create and manage cron jobs" },
    "browser":   { "label": "Browser Automation",   "desc": "Requires BROWSERBASE_API_KEY" },
    "vision":    { "label": "Image Analysis",       "desc": "Requires OPENROUTER_API_KEY" },
    "image_gen": { "label": "Image Generation",     "desc": "Requires FAL_KEY" },
    "tts":       { "label": "Text-to-Speech",       "desc": "Edge TTS free; paid providers need API Key" },
    "moa":       { "label": "Multi-Model Reasoning","desc": "Mixture of Agents, requires OPENROUTER_API_KEY" }
  },
```

- [ ] **Step 4: TypeScript 类型检查**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npx tsc --noEmit 2>&1
```

Expected: 零错误。

- [ ] **Step 5: 提交**

```bash
git add src/lib/tauri.ts src/locales/zh/translation.json src/locales/en/translation.json
git commit -m "feat: add getTools/saveTools bindings and tools i18n translations"
```

---

## Task 3: ToolsPanel.tsx + 测试 + App.tsx 接入

**Files:**
- Create: `src/components/panels/ToolsPanel.tsx`
- Create: `src/__tests__/panels/ToolsPanel.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写失败测试 — 创建 `src/__tests__/panels/ToolsPanel.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolsPanel } from "../../components/panels/ToolsPanel";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_tools")
      return Promise.resolve(["terminal", "file", "web", "memory", "skills", "todo", "cronjob",
        "browser", "vision", "image_gen", "tts", "moa"]);
    if (cmd === "save_tools") return Promise.resolve();
    return Promise.resolve();
  });
});

describe("ToolsPanel", () => {
  it("renders core tools section header", async () => {
    render(<ToolsPanel />);
    await waitFor(() =>
      expect(screen.getByText("tools.coreSection")).toBeInTheDocument()
    );
  });

  it("renders optional tools section header", async () => {
    render(<ToolsPanel />);
    await waitFor(() =>
      expect(screen.getByText("tools.optionalSection")).toBeInTheDocument()
    );
  });

  it("renders all 12 tool toggles", async () => {
    render(<ToolsPanel />);
    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(12);
    });
  });

  it("calls save_tools when a toggle changes", async () => {
    render(<ToolsPanel />);
    await waitFor(() => screen.getAllByRole("checkbox"));
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("save_tools", { toolsets: expect.any(Array) })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npm test -- --run src/__tests__/panels/ToolsPanel.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../../components/panels/ToolsPanel'`

- [ ] **Step 3: 创建 `src/components/panels/ToolsPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Commands } from "../../lib/tauri";
import { useUIStore } from "../../store";
import { Toggle } from "../ui/Toggle";

type ToolsetId =
  | "terminal" | "file" | "web" | "memory" | "skills" | "todo" | "cronjob"
  | "browser" | "vision" | "image_gen" | "tts" | "moa";

interface ToolDef {
  id: ToolsetId;
  labelKey: string;
  descKey: string;
}

const CORE_TOOLS: ToolDef[] = [
  { id: "terminal",  labelKey: "tools.terminal.label",  descKey: "tools.terminal.desc"  },
  { id: "file",      labelKey: "tools.file.label",      descKey: "tools.file.desc"      },
  { id: "web",       labelKey: "tools.web.label",       descKey: "tools.web.desc"       },
  { id: "memory",    labelKey: "tools.memory.label",    descKey: "tools.memory.desc"    },
  { id: "skills",    labelKey: "tools.skills.label",    descKey: "tools.skills.desc"    },
  { id: "todo",      labelKey: "tools.todo.label",      descKey: "tools.todo.desc"      },
  { id: "cronjob",   labelKey: "tools.cronjob.label",   descKey: "tools.cronjob.desc"   },
];

const OPTIONAL_TOOLS: ToolDef[] = [
  { id: "browser",   labelKey: "tools.browser.label",   descKey: "tools.browser.desc"   },
  { id: "vision",    labelKey: "tools.vision.label",    descKey: "tools.vision.desc"    },
  { id: "image_gen", labelKey: "tools.image_gen.label", descKey: "tools.image_gen.desc" },
  { id: "tts",       labelKey: "tools.tts.label",       descKey: "tools.tts.desc"       },
  { id: "moa",       labelKey: "tools.moa.label",       descKey: "tools.moa.desc"       },
];

export function ToolsPanel() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const [activeToolsets, setActiveToolsets] = useState<Set<ToolsetId>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    Commands.getTools()
      .then((toolsets) => {
        if (active) {
          setActiveToolsets(new Set(toolsets as ToolsetId[]));
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) {
          const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
          showToast(`${t("tools.loadFailed")}: ${msg}`, "error");
          setLoaded(true);
        }
      });
    return () => { active = false; };
  }, [showToast, t]);

  async function handleToggle(id: ToolsetId, checked: boolean) {
    const prev = new Set(activeToolsets);
    const next = new Set(activeToolsets);
    if (checked) next.add(id);
    else next.delete(id);
    setActiveToolsets(next);

    try {
      await Commands.saveTools([...next]);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setShowSaved(true);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
    } catch (e) {
      setActiveToolsets(prev);
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("tools.saveFailed")}: ${msg}`, "error");
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-32 text-text-secondary text-[13px]">
        Loading...
      </div>
    );
  }

  function renderGroup(tools: ToolDef[], titleKey: string) {
    return (
      <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        <div className="text-[11px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
          {t(titleKey)}
        </div>
        <div className="space-y-4 divide-y divide-bg-secondary">
          {tools.map((tool, i) => (
            <div key={tool.id} className={i > 0 ? "pt-3" : ""}>
              <Toggle
                label={t(tool.labelKey)}
                description={t(tool.descKey)}
                checked={activeToolsets.has(tool.id)}
                onChange={(checked) => handleToggle(tool.id, checked)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end h-5">
        {showSaved && (
          <span className="text-[12px] text-accent font-[600]">✓ {t("tools.saved")}</span>
        )}
      </div>
      {renderGroup(CORE_TOOLS, "tools.coreSection")}
      {renderGroup(OPTIONAL_TOOLS, "tools.optionalSection")}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npm test -- --run src/__tests__/panels/ToolsPanel.test.tsx 2>&1 | tail -10
```

Expected: 4 passed (4).

- [ ] **Step 5: 修改 `src/App.tsx` — 接入 ToolsPanel**

在 import 区追加：
```tsx
import { ToolsPanel } from "./components/panels/ToolsPanel";
```

将：
```tsx
          {(activePanel === "tools" || activePanel === "gateway" || activePanel === "migrate") && (
            <PlaceholderPanel />
          )}
```

替换为：
```tsx
          {activePanel === "tools"   && <ToolsPanel />}
          {(activePanel === "gateway" || activePanel === "migrate") && (
            <PlaceholderPanel />
          )}
```

- [ ] **Step 6: 运行全部测试**

```bash
cd /Users/laputancnai/HermesHelper/.worktrees/feature/phase1
npm test -- --run 2>&1 | tail -10
```

Expected: 19 passed (5 test files), 0 failures.

- [ ] **Step 7: TypeScript 类型检查**

```bash
npx tsc --noEmit 2>&1
```

Expected: 零错误。

- [ ] **Step 8: 提交**

```bash
git add src/components/panels/ToolsPanel.tsx src/__tests__/panels/ToolsPanel.test.tsx src/App.tsx
git commit -m "feat: implement ToolsPanel with auto-save toggles for cli-config.yaml toolsets"
```

---

## Self-Review Checklist（实现完成后验证）

- [ ] `npm test -- --run` 全部通过（前端 19 个测试）
- [ ] `cd src-tauri && cargo test` 全部通过（Rust 15 个测试）
- [ ] `npx tsc --noEmit` 零错误
- [ ] 浏览器打开 Tools 面板，12 个 Toggle 正确渲染
- [ ] 拨动 Toggle 后右上角出现 "✓ 已保存" badge，1.5 秒消失
- [ ] `~/.hermes/cli-config.yaml` 文件内容中 `platform_toolsets.cli` 被正确更新
