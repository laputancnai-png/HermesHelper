# Migrate Panel Design

## Overview

为 HermesHelper 实现 Migrate（导入/导出）面板，支持将 `~/.hermes` 下的 6 类数据打包为 `.zip` 备份，以及从 `.zip` 文件恢复数据，并在文件级别解决冲突。

---

## Architecture

### Rust 后端

新增 `src-tauri/src/commands/migrate.rs`，3 个 Tauri 命令：

| 命令 | 签名 | 功能 |
|------|------|------|
| `export_data` | `(items: Vec<String>, include_api_keys: bool, save_path: String) -> Result<(), String>` | 将选中类别打包写入指定路径的 `.zip` |
| `preview_import` | `(zip_path: String) -> Result<Vec<ImportFileInfo>, String>` | 解析 zip，对比磁盘文件，返回冲突信息 |
| `execute_import` | `(zip_path: String, selected_files: Vec<String>) -> Result<ImportSummary, String>` | 将选中文件写入 `~/.hermes` |

**数据类别 → 路径映射（`~/.hermes` 下）：**

| 类别 key | 路径 |
|----------|------|
| `config` | `config.toml` + `.env` |
| `memory` | `memory/`（目录） |
| `skills` | `skills/`（目录） |
| `history` | `history/`（目录） |
| `cron` | `cron/`（目录） |
| `hooks` | `hooks/`（目录） |

**API Key 过滤规则：**
- 导出 `config` 类别且 `include_api_keys = false` 时，从 `.env` 内容中删除匹配 `*_KEY=` 或 `*_TOKEN=` 的行后再写入 zip
- 过滤失败的单行跳过处理，不阻断整体导出

**文件对话框：** 使用 `tauri-plugin-dialog`（若 `Cargo.toml` 中尚未包含则添加）

### Rust 数据类型

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFileInfo {
    pub path: String,         // zip 内的相对路径
    pub category: String,     // 所属类别 key
    pub has_conflict: bool,   // 磁盘上是否已存在该文件
}

#[derive(Serialize)]
pub struct ImportSummary {
    pub imported: usize,
    pub skipped: usize,
}
```

### 注册到 `lib.rs`

`src-tauri/src/commands/mod.rs` 新增 `pub mod migrate;`，`lib.rs` invoke_handler 加入 3 个命令。

---

## Frontend

### TypeScript 类型（新增至 `src/lib/tauri.ts`）

```typescript
export interface ImportFileInfo {
  path: string;
  category: string;
  hasConflict: boolean;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
}
```

`Commands` 对象新增：

```typescript
exportData: (items: string[], includeApiKeys: boolean, savePath: string): Promise<void> =>
  tauriInvoke("export_data", { items, includeApiKeys, savePath }),
previewImport: (zipPath: string): Promise<ImportFileInfo[]> =>
  tauriInvoke("preview_import", { zipPath }),
executeImport: (zipPath: string, selectedFiles: string[]): Promise<ImportSummary> =>
  tauriInvoke("execute_import", { zipPath, selectedFiles }),
```

### 组件：`src/components/panels/MigratePanel.tsx`

**State：**

```typescript
activeTab: "export" | "import"

// Export tab
selectedItems: Set<string>    // 初始全选 6 类
includeApiKeys: boolean        // 默认 false
exporting: boolean

// Import tab
zipPath: string | null
importPreview: ImportFileInfo[] | null
fileSelections: Record<string, boolean>  // path → selected
previewing: boolean
importing: boolean
importResult: ImportSummary | null
```

**Export 流程：**
1. 用户勾选类别（默认全选）+ 可选"包含 API Key"
2. 点击"导出" → 前端调 `save()` 对话框获取路径 → `export_data(items, includeApiKeys, savePath)` → toast 显示保存路径
3. 出错 → toast 显示错误信息

**Import 流程（三步，同一 tab 内切换）：**
- **Step 1（选文件）：** "选择 .zip 文件"按钮 → `open()` 对话框 → 调用 `preview_import`
- **Step 2（冲突解决）：** 文件列表（冲突/非冲突均默认勾选）；顶部显示冲突数量摘要；提供全选/取消全选
- **Step 3（结果）：** "确认导入" → `execute_import` → 显示"已导入 N 个，跳过 M 个"；"重新导入"按钮回到 Step 1

### 翻译键（`migrate` 命名空间）

中/英文各添加以下键：

```
migrate.section         标题
migrate.exportTab       导出 tab 标签
migrate.importTab       导入 tab 标签
migrate.items.config    配置文件
migrate.items.memory    记忆
migrate.items.skills    技能库
migrate.items.history   会话历史
migrate.items.cron      Cron 任务
migrate.items.hooks     Hooks
migrate.includeApiKeys  包含 API Key 勾选项
migrate.export          导出按钮
migrate.exporting       导出中...
migrate.exportSuccess   导出成功：{path}
migrate.exportFailed    导出失败
migrate.selectFile      选择 .zip 文件
migrate.previewing      解析中...
migrate.conflictsFound  发现 {count} 个冲突文件
migrate.noConflicts     无冲突
migrate.selectAll       全选
migrate.deselectAll     取消全选
migrate.confirmImport   确认导入
migrate.importing       导入中...
migrate.importSuccess   已导入 {imported} 个，跳过 {skipped} 个
migrate.importFailed    导入失败
migrate.importAgain     重新导入
migrate.invalidZip      无效的备份文件
migrate.hasConflict     (将覆盖)
```

### `App.tsx`

将 `{activePanel === "migrate" && <PlaceholderPanel />}` 替换为 `<MigratePanel />`。

---

## Error Handling

| 场景 | 处理 |
|------|------|
| `~/.hermes` 不存在 | 导出空 zip；导入正常写入（创建目录） |
| zip 损坏或格式错误 | `preview_import` 返回 `Err`，toast "无效的备份文件" |
| 导出路径无写入权限 | Rust 返回 `Err`，toast 提示 |
| API Key 行解析异常 | 跳过该行，继续导出 |
| 导入文件写入失败 | 记录到 `skipped` 计数，不中断整体导入 |

---

## Testing

### Rust 单元测试（`migrate.rs` 底部，使用 `tempfile::tempdir()`）

1. 导出全部 6 类 → zip 内含预期文件路径
2. 导出时 `include_api_keys = false` → `.env` 中 `*_KEY=`/`*_TOKEN=` 行被移除
3. 导出时 `include_api_keys = true` → API Key 行保留
4. `preview_import` 正确标记已存在文件为 `has_conflict: true`
5. `execute_import` 只写入 `selected_files` 中的文件

### React 测试（`src/__tests__/panels/MigratePanel.test.tsx`）

1. 渲染 Export / Import 两个 tab
2. Export：默认全选 6 类，API Key 默认未勾选
3. Export：点击"导出"调用 `export_data`，传入正确 items 列表
4. Import Step 1 → Step 2：选文件后展示冲突列表
5. Import Step 2：冲突文件默认勾选
6. Import Step 2 → Step 3：确认导入调用 `execute_import`，只传入勾选的文件
