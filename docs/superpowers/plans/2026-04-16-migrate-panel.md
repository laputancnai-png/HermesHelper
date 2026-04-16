# Migrate Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Migrate panel for HermesHelper, allowing users to export `~/.hermes` data to a `.zip` file and import it back with file-level conflict resolution.

**Architecture:** A new Rust module `migrate.rs` provides three testable helper functions (export, preview, execute) wrapped in Tauri commands. The frontend `MigratePanel.tsx` uses a two-tab layout (Export / Import) and calls `@tauri-apps/plugin-dialog` for file dialogs before invoking the Rust commands.

**Tech Stack:** Tauri 2, React 18, TypeScript, zip 2 crate, tauri-plugin-dialog, Vitest + React Testing Library

---

## Task 1: Add tauri-plugin-dialog

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add Cargo dependency**

Open `src-tauri/Cargo.toml`. In `[dependencies]`, add after `tauri-plugin-shell = "2"`:

```toml
tauri-plugin-dialog = "2"
```

- [ ] **Step 2: Add capability permission**

Open `src-tauri/capabilities/default.json`. Replace the full file with:

```json
{
  "$schema": "https://schema.tauri.app/config/2/capability",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:default",
    "dialog:default"
  ]
}
```

- [ ] **Step 3: Initialize plugin in lib.rs**

Open `src-tauri/src/lib.rs`. After `.plugin(tauri_plugin_shell::init())`, add:

```rust
.plugin(tauri_plugin_dialog::init())
```

So it reads:

```rust
.plugin(tauri_plugin_shell::init())
.plugin(tauri_plugin_dialog::init())
```

- [ ] **Step 4: Install npm package**

```bash
npm install @tauri-apps/plugin-dialog
```

- [ ] **Step 5: Verify Cargo builds**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: build succeeds (may take a minute for new dep).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/capabilities/default.json src-tauri/src/lib.rs package.json package-lock.json
git commit -m "chore: add tauri-plugin-dialog"
```

---

## Task 2: Rust migrate module — export helper (TDD)

**Files:**
- Create: `src-tauri/src/commands/migrate.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Register the module**

Open `src-tauri/src/commands/mod.rs`. Add at the end:

```rust
pub mod migrate;
```

Full file should read:

```rust
pub mod config;
pub mod gateway;
pub mod installer;
pub mod migrate;
pub mod process;
pub mod tools;
```

- [ ] **Step 2: Create migrate.rs with types and failing tests**

Create `src-tauri/src/commands/migrate.rs`:

```rust
use serde::Serialize;
use std::path::{Path, PathBuf};

// ── Path helper ───────────────────────────────────────────────────

pub(crate) fn hermes_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())
        .map(|h| h.join(".hermes"))
}

// ── Domain types ──────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFileInfo {
    pub path: String,
    pub category: String,
    pub has_conflict: bool,
}

#[derive(Serialize)]
pub struct ImportSummary {
    pub imported: usize,
    pub skipped: usize,
}

// ── Export helper ─────────────────────────────────────────────────

/// Filter lines that contain an API key or token from .env content.
pub(crate) fn filter_api_keys(content: &str) -> String {
    let filtered: Vec<&str> = content
        .lines()
        .filter(|line| {
            let upper = line.to_uppercase();
            !upper.contains("_KEY=") && !upper.contains("_TOKEN=")
        })
        .collect();
    if filtered.is_empty() {
        String::new()
    } else {
        filtered.join("\n") + "\n"
    }
}

pub(crate) fn export_data_to(
    items: &[String],
    include_api_keys: bool,
    save_path: &Path,
    hermes_base: &Path,
) -> Result<(), String> {
    use std::io::Write as _;

    if let Some(parent) = save_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Cannot create output dir: {e}"))?;
        }
    }

    let file = std::fs::File::create(save_path)
        .map_err(|e| format!("Cannot create zip file: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);
    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for item in items {
        match item.as_str() {
            "config" => {
                // config.toml
                let toml_path = hermes_base.join("config.toml");
                if toml_path.exists() {
                    let content = std::fs::read(&toml_path)
                        .map_err(|e| format!("Cannot read config.toml: {e}"))?;
                    zip.start_file("config.toml", options)
                        .map_err(|e| format!("Zip error: {e}"))?;
                    zip.write_all(&content)
                        .map_err(|e| format!("Zip write error: {e}"))?;
                }
                // .env
                let env_path = hermes_base.join(".env");
                if env_path.exists() {
                    let raw = std::fs::read_to_string(&env_path)
                        .map_err(|e| format!("Cannot read .env: {e}"))?;
                    let content = if include_api_keys {
                        raw
                    } else {
                        filter_api_keys(&raw)
                    };
                    zip.start_file(".env", options)
                        .map_err(|e| format!("Zip error: {e}"))?;
                    zip.write_all(content.as_bytes())
                        .map_err(|e| format!("Zip write error: {e}"))?;
                }
            }
            dir_name @ ("memory" | "skills" | "history" | "cron" | "hooks") => {
                let dir = hermes_base.join(dir_name);
                if dir.exists() && dir.is_dir() {
                    add_dir_to_zip(&mut zip, &dir, dir_name, options)?;
                }
            }
            _ => {} // unknown item, skip
        }
    }

    zip.finish().map_err(|e| format!("Zip finish error: {e}"))?;
    Ok(())
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    base_dir: &Path,
    zip_prefix: &str,
    options: zip::write::SimpleFileOptions,
) -> Result<(), String> {
    use std::io::Write as _;

    let mut stack = vec![base_dir.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = std::fs::read_dir(&dir)
            .map_err(|e| format!("Cannot read dir {}: {e}", dir.display()))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("Dir entry error: {e}"))?;
            let path = entry.path();
            let relative = path
                .strip_prefix(base_dir)
                .map_err(|e| format!("Path strip error: {e}"))?;
            let zip_name = format!(
                "{}/{}",
                zip_prefix,
                relative.to_string_lossy().replace('\\', "/")
            );

            if path.is_file() {
                let content = std::fs::read(&path)
                    .map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
                zip.start_file(&zip_name, options)
                    .map_err(|e| format!("Zip start_file error: {e}"))?;
                zip.write_all(&content)
                    .map_err(|e| format!("Zip write error: {e}"))?;
            } else if path.is_dir() {
                stack.push(path);
            }
        }
    }
    Ok(())
}

// ── Tauri commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn export_data(
    items: Vec<String>,
    include_api_keys: bool,
    save_path: String,
) -> Result<(), String> {
    let hermes_base = hermes_dir()?;
    let path = std::path::Path::new(&save_path);
    export_data_to(&items, include_api_keys, path, &hermes_base)
}

// ── Tests ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_export_config_creates_zip_with_toml() {
        let src = tempdir().unwrap();
        std::fs::write(src.path().join("config.toml"), b"model = \"test\"").unwrap();
        let dst = tempdir().unwrap();
        let zip_path = dst.path().join("backup.zip");

        export_data_to(&["config".to_string()], true, &zip_path, src.path()).unwrap();

        let file = std::fs::File::open(&zip_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .collect();
        assert!(names.contains(&"config.toml".to_string()));
    }

    #[test]
    fn test_export_filters_api_keys_from_env() {
        let src = tempdir().unwrap();
        std::fs::write(
            src.path().join(".env"),
            "OTHER_VAR=keep\nOPENAI_API_KEY=secret\nTELEGRAM_BOT_TOKEN=tok\n",
        )
        .unwrap();
        let dst = tempdir().unwrap();
        let zip_path = dst.path().join("backup.zip");

        export_data_to(&["config".to_string()], false, &zip_path, src.path()).unwrap();

        let file = std::fs::File::open(&zip_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let mut env_file = archive.by_name(".env").unwrap();
        let mut content = String::new();
        std::io::Read::read_to_string(&mut env_file, &mut content).unwrap();
        assert!(content.contains("OTHER_VAR=keep"), "non-key lines preserved");
        assert!(!content.contains("OPENAI_API_KEY"), "API key filtered");
        assert!(!content.contains("TELEGRAM_BOT_TOKEN"), "token filtered");
    }

    #[test]
    fn test_export_includes_api_keys_when_flag_true() {
        let src = tempdir().unwrap();
        std::fs::write(src.path().join(".env"), "OPENAI_API_KEY=secret\n").unwrap();
        let dst = tempdir().unwrap();
        let zip_path = dst.path().join("backup.zip");

        export_data_to(&["config".to_string()], true, &zip_path, src.path()).unwrap();

        let file = std::fs::File::open(&zip_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let mut env_file = archive.by_name(".env").unwrap();
        let mut content = String::new();
        std::io::Read::read_to_string(&mut env_file, &mut content).unwrap();
        assert!(content.contains("OPENAI_API_KEY=secret"), "key kept when flag=true");
    }

    #[test]
    fn test_export_missing_hermes_dir_creates_empty_zip() {
        let src = tempdir().unwrap();
        // No files created in src
        let dst = tempdir().unwrap();
        let zip_path = dst.path().join("backup.zip");

        export_data_to(
            &["config".to_string(), "memory".to_string()],
            false,
            &zip_path,
            src.path(),
        )
        .unwrap();

        let file = std::fs::File::open(&zip_path).unwrap();
        let archive = zip::ZipArchive::new(file).unwrap();
        assert_eq!(archive.len(), 0, "empty zip when no files exist");
    }

    #[test]
    fn test_filter_api_keys_removes_key_and_token_lines() {
        let input = "FOO=bar\nOPENAI_API_KEY=secret\nBAZ=qux\nTELEGRAM_BOT_TOKEN=tok\n";
        let result = filter_api_keys(input);
        assert!(result.contains("FOO=bar"));
        assert!(result.contains("BAZ=qux"));
        assert!(!result.contains("OPENAI_API_KEY"));
        assert!(!result.contains("TELEGRAM_BOT_TOKEN"));
    }
}
```

- [ ] **Step 3: Run the failing tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml migrate
```

Expected: compilation fails because `export_data_to` body is not yet filled (if you pasted types-only first), or tests pass immediately since the full implementation is in step 2. Either way, verify the module compiles cleanly:

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `warning: unused imports` at most, no errors.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cargo test --manifest-path src-tauri/Cargo.toml migrate
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/migrate.rs src-tauri/src/commands/mod.rs
git commit -m "feat: rust migrate module - export helper with tests"
```

---

## Task 3: Rust migrate module — preview_import and execute_import helpers (TDD)

**Files:**
- Modify: `src-tauri/src/commands/migrate.rs`

- [ ] **Step 1: Add failing tests for preview_import and execute_import**

In `migrate.rs`, inside the `#[cfg(test)] mod tests` block, add these tests BEFORE implementing the functions:

```rust
    #[test]
    fn test_preview_import_marks_existing_files_as_conflict() {
        let hermes = tempdir().unwrap();
        // Pre-create config.toml in hermes dir
        std::fs::write(hermes.path().join("config.toml"), b"existing").unwrap();

        // Create a zip with config.toml and .env
        let zip_dir = tempdir().unwrap();
        let zip_path = zip_dir.path().join("backup.zip");
        let file = std::fs::File::create(&zip_path).unwrap();
        let mut writer = zip::ZipWriter::new(file);
        let opts = zip::write::SimpleFileOptions::default();
        writer.start_file("config.toml", opts).unwrap();
        std::io::Write::write_all(&mut writer, b"new content").unwrap();
        writer.start_file(".env", opts).unwrap();
        std::io::Write::write_all(&mut writer, b"KEY=val").unwrap();
        writer.finish().unwrap();

        let files = preview_import_from(&zip_path, hermes.path()).unwrap();
        assert_eq!(files.len(), 2);
        let toml = files.iter().find(|f| f.path == "config.toml").unwrap();
        let env = files.iter().find(|f| f.path == ".env").unwrap();
        assert!(toml.has_conflict, "config.toml exists → conflict");
        assert!(!env.has_conflict, ".env does not exist → no conflict");
    }

    #[test]
    fn test_execute_import_only_writes_selected_files() {
        let hermes = tempdir().unwrap();

        // Build zip with two files
        let zip_dir = tempdir().unwrap();
        let zip_path = zip_dir.path().join("backup.zip");
        let file = std::fs::File::create(&zip_path).unwrap();
        let mut writer = zip::ZipWriter::new(file);
        let opts = zip::write::SimpleFileOptions::default();
        writer.start_file("config.toml", opts).unwrap();
        std::io::Write::write_all(&mut writer, b"content_a").unwrap();
        writer.start_file(".env", opts).unwrap();
        std::io::Write::write_all(&mut writer, b"content_b").unwrap();
        writer.finish().unwrap();

        // Only select config.toml
        let summary =
            execute_import_from(&zip_path, &["config.toml".to_string()], hermes.path()).unwrap();

        assert_eq!(summary.imported, 1);
        assert_eq!(summary.skipped, 1);
        assert!(hermes.path().join("config.toml").exists());
        assert!(!hermes.path().join(".env").exists());
    }

    #[test]
    fn test_execute_import_creates_parent_dirs() {
        let hermes = tempdir().unwrap();

        let zip_dir = tempdir().unwrap();
        let zip_path = zip_dir.path().join("backup.zip");
        let file = std::fs::File::create(&zip_path).unwrap();
        let mut writer = zip::ZipWriter::new(file);
        let opts = zip::write::SimpleFileOptions::default();
        writer.start_file("memory/notes.md", opts).unwrap();
        std::io::Write::write_all(&mut writer, b"hello").unwrap();
        writer.finish().unwrap();

        execute_import_from(
            &zip_path,
            &["memory/notes.md".to_string()],
            hermes.path(),
        )
        .unwrap();

        let dest = hermes.path().join("memory").join("notes.md");
        assert!(dest.exists(), "memory/notes.md should be created");
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "hello");
    }
```

- [ ] **Step 2: Run tests to verify they fail (functions don't exist yet)**

```bash
cargo test --manifest-path src-tauri/Cargo.toml migrate
```

Expected: FAIL — `preview_import_from` and `execute_import_from` not found.

- [ ] **Step 3: Implement preview_import_from**

In `migrate.rs`, add after `export_data_to` and helpers, before `#[tauri::command]`:

```rust
pub(crate) fn infer_category(zip_path: &str) -> String {
    match zip_path.split('/').next().unwrap_or("") {
        d @ ("memory" | "skills" | "history" | "cron" | "hooks") => d.to_string(),
        _ => "config".to_string(),
    }
}

pub(crate) fn preview_import_from(
    zip_path: &Path,
    hermes_base: &Path,
) -> Result<Vec<ImportFileInfo>, String> {
    let file =
        std::fs::File::open(zip_path).map_err(|e| format!("Cannot open zip: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip: {e}"))?;

    let mut files = Vec::new();
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip read error: {e}"))?;
        if entry.is_file() {
            let name = entry.name().to_string();
            let category = infer_category(&name);
            let dest = hermes_base.join(&name);
            let has_conflict = dest.exists();
            files.push(ImportFileInfo {
                path: name,
                category,
                has_conflict,
            });
        }
    }
    Ok(files)
}
```

- [ ] **Step 4: Implement execute_import_from**

In `migrate.rs`, add after `preview_import_from`:

```rust
pub(crate) fn execute_import_from(
    zip_path: &Path,
    selected_files: &[String],
    hermes_base: &Path,
) -> Result<ImportSummary, String> {
    use std::collections::HashSet;
    use std::io::Read as _;

    let selected: HashSet<&str> = selected_files.iter().map(String::as_str).collect();

    let file =
        std::fs::File::open(zip_path).map_err(|e| format!("Cannot open zip: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip: {e}"))?;

    let mut imported = 0usize;
    let mut skipped = 0usize;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip read error: {e}"))?;
        if !entry.is_file() {
            continue;
        }
        let name = entry.name().to_string();
        if !selected.contains(name.as_str()) {
            skipped += 1;
            continue;
        }
        let dest = hermes_base.join(&name);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Cannot create dir: {e}"))?;
        }
        let mut content = Vec::new();
        entry
            .read_to_end(&mut content)
            .map_err(|e| format!("Cannot read entry: {e}"))?;
        if std::fs::write(&dest, &content).is_ok() {
            imported += 1;
        } else {
            skipped += 1;
        }
    }

    Ok(ImportSummary { imported, skipped })
}
```

- [ ] **Step 5: Add Tauri commands for preview_import and execute_import**

In `migrate.rs`, after `export_data` command, add:

```rust
#[tauri::command]
pub async fn preview_import(zip_path: String) -> Result<Vec<ImportFileInfo>, String> {
    let hermes_base = hermes_dir()?;
    preview_import_from(std::path::Path::new(&zip_path), &hermes_base)
}

#[tauri::command]
pub async fn execute_import(
    zip_path: String,
    selected_files: Vec<String>,
) -> Result<ImportSummary, String> {
    let hermes_base = hermes_dir()?;
    execute_import_from(
        std::path::Path::new(&zip_path),
        &selected_files,
        &hermes_base,
    )
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cargo test --manifest-path src-tauri/Cargo.toml migrate
```

Expected: `8 passed`.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/migrate.rs
git commit -m "feat: rust migrate module - preview and execute import helpers"
```

---

## Task 4: Register migrate commands in Tauri invoke_handler

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add migrate to use statement and invoke_handler**

Open `src-tauri/src/lib.rs`. Change the use statement from:

```rust
use commands::{config, gateway, installer, process, tools};
```

to:

```rust
use commands::{config, gateway, installer, migrate, process, tools};
```

In `invoke_handler`, after `gateway::stop_gateway,`, add:

```rust
migrate::export_data,
migrate::preview_import,
migrate::execute_import,
```

Full invoke_handler block should end with:

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
    migrate::export_data,
    migrate::preview_import,
    migrate::execute_import,
])
```

- [ ] **Step 2: Verify build**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register migrate commands in Tauri invoke_handler"
```

---

## Task 5: TypeScript types, Commands, and translations

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/locales/zh/translation.json`
- Modify: `src/locales/en/translation.json`

- [ ] **Step 1: Add types to tauri.ts**

Open `src/lib/tauri.ts`. After the `GatewayStatus` interface (line ~57), add:

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

- [ ] **Step 2: Add Commands to tauri.ts**

In the `Commands` object, after `stopGateway`, add:

```typescript
  exportData: (items: string[], includeApiKeys: boolean, savePath: string): Promise<void> =>
    tauriInvoke("export_data", { items, includeApiKeys, savePath }),

  previewImport: (zipPath: string): Promise<ImportFileInfo[]> =>
    tauriInvoke("preview_import", { zipPath }),

  executeImport: (zipPath: string, selectedFiles: string[]): Promise<ImportSummary> =>
    tauriInvoke("execute_import", { zipPath, selectedFiles }),
```

- [ ] **Step 3: Add Chinese translations**

Open `src/locales/zh/translation.json`. After the `"gateway"` block and before `"toast"`, add:

```json
  "migrate": {
    "section":        "导入 / 导出",
    "exportTab":      "导出",
    "importTab":      "导入",
    "items": {
      "config":   "配置文件",
      "memory":   "记忆",
      "skills":   "技能库",
      "history":  "会话历史",
      "cron":     "Cron 任务",
      "hooks":    "Hooks"
    },
    "includeApiKeys": "包含 API Key（导出时明文写入）",
    "export":         "导出备份",
    "exporting":      "导出中...",
    "exportSuccess":  "导出成功",
    "exportFailed":   "导出失败",
    "selectFile":     "选择 .zip 文件",
    "previewing":     "解析中...",
    "conflictsFound": "发现 {count} 个冲突文件",
    "noConflicts":    "无冲突文件",
    "selectAll":      "全选",
    "deselectAll":    "取消全选",
    "confirmImport":  "确认导入",
    "importing":      "导入中...",
    "importSuccess":  "已导入 {imported} 个，跳过 {skipped} 个",
    "importFailed":   "导入失败",
    "importAgain":    "重新导入",
    "invalidZip":     "无效的备份文件",
    "hasConflict":    "（将覆盖）"
  },
```

Note: `{count}`, `{imported}`, `{skipped}` are placeholder strings replaced in the component via `.replace()`.

- [ ] **Step 4: Add English translations**

Open `src/locales/en/translation.json`. After the `"gateway"` block and before `"toast"`, add:

```json
  "migrate": {
    "section":        "IMPORT / EXPORT",
    "exportTab":      "Export",
    "importTab":      "Import",
    "items": {
      "config":   "Config Files",
      "memory":   "Memory",
      "skills":   "Skills Library",
      "history":  "Session History",
      "cron":     "Cron Jobs",
      "hooks":    "Hooks"
    },
    "includeApiKeys": "Include API Keys (written in plaintext)",
    "export":         "Export Backup",
    "exporting":      "Exporting...",
    "exportSuccess":  "Export successful",
    "exportFailed":   "Export failed",
    "selectFile":     "Select .zip file",
    "previewing":     "Parsing...",
    "conflictsFound": "{count} conflicting files found",
    "noConflicts":    "No conflicts",
    "selectAll":      "Select All",
    "deselectAll":    "Deselect All",
    "confirmImport":  "Confirm Import",
    "importing":      "Importing...",
    "importSuccess":  "{imported} imported, {skipped} skipped",
    "importFailed":   "Import failed",
    "importAgain":    "Import Again",
    "invalidZip":     "Invalid backup file",
    "hasConflict":    "(will overwrite)"
  },
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tauri.ts src/locales/zh/translation.json src/locales/en/translation.json
git commit -m "feat: migrate panel TS types, commands, and translations"
```

---

## Task 6: MigratePanel React tests (write failing tests first)

**Files:**
- Create: `src/__tests__/panels/MigratePanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/panels/MigratePanel.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MigratePanel } from "../../components/panels/MigratePanel";
import { invoke } from "@tauri-apps/api/core";

// Mock plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

import { open, save } from "@tauri-apps/plugin-dialog";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;
const mockOpen = open as ReturnType<typeof vi.fn>;
const mockSave = save as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockOpen.mockResolvedValue(null);
  mockSave.mockResolvedValue(null);
  mockInvoke.mockResolvedValue(undefined);
});

describe("MigratePanel", () => {
  it("renders Export and Import tabs", () => {
    render(<MigratePanel />);
    expect(screen.getByText("migrate.exportTab")).toBeInTheDocument();
    expect(screen.getByText("migrate.importTab")).toBeInTheDocument();
  });

  it("Export tab: all 6 item checkboxes checked by default, API Key unchecked", () => {
    render(<MigratePanel />);
    // 6 item checkboxes + 1 API key checkbox = 7 total
    const checkboxes = Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ) as HTMLInputElement[];
    expect(checkboxes).toHaveLength(7);
    // First 6 are item checkboxes — all checked
    checkboxes.slice(0, 6).forEach((cb) => expect(cb).toBeChecked());
    // Last one is API Key — unchecked
    expect(checkboxes[6]).not.toBeChecked();
  });

  it("Export tab: clicking export button calls export_data with all items", async () => {
    mockSave.mockResolvedValue("/tmp/backup.zip");
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.export"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "export_data",
        expect.objectContaining({
          items: ["config", "memory", "skills", "history", "cron", "hooks"],
          includeApiKeys: false,
          savePath: "/tmp/backup.zip",
        })
      )
    );
  });

  it("Import tab: shows select file button on step 1", async () => {
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.importTab"));
    expect(screen.getByText("migrate.selectFile")).toBeInTheDocument();
  });

  it("Import tab: after selecting file, shows conflict list with conflict label", async () => {
    mockOpen.mockResolvedValue("/tmp/backup.zip");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "preview_import")
        return Promise.resolve([
          { path: "config.toml", category: "config", hasConflict: true },
          { path: ".env", category: "config", hasConflict: false },
        ]);
      return Promise.resolve();
    });
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.importTab"));
    await userEvent.click(screen.getByText("migrate.selectFile"));
    await waitFor(() =>
      expect(screen.getByText("config.toml")).toBeInTheDocument()
    );
    expect(screen.getByText(".env")).toBeInTheDocument();
    // conflict badge on conflicting file
    expect(screen.getByText("migrate.hasConflict")).toBeInTheDocument();
  });

  it("Import tab: all files are checked by default after preview", async () => {
    mockOpen.mockResolvedValue("/tmp/backup.zip");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "preview_import")
        return Promise.resolve([
          { path: "config.toml", category: "config", hasConflict: true },
          { path: ".env", category: "config", hasConflict: false },
        ]);
      return Promise.resolve();
    });
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.importTab"));
    await userEvent.click(screen.getByText("migrate.selectFile"));
    await waitFor(() =>
      expect(screen.getByText("config.toml")).toBeInTheDocument()
    );
    const checkboxes = Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ) as HTMLInputElement[];
    checkboxes.forEach((cb) => expect(cb).toBeChecked());
  });

  it("Import tab: confirm import calls execute_import with selected files only", async () => {
    mockOpen.mockResolvedValue("/tmp/backup.zip");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "preview_import")
        return Promise.resolve([
          { path: "config.toml", category: "config", hasConflict: false },
        ]);
      if (cmd === "execute_import")
        return Promise.resolve({ imported: 1, skipped: 0 });
      return Promise.resolve();
    });
    render(<MigratePanel />);
    await userEvent.click(screen.getByText("migrate.importTab"));
    await userEvent.click(screen.getByText("migrate.selectFile"));
    await waitFor(() =>
      expect(screen.getByText("migrate.confirmImport")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByText("migrate.confirmImport"));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "execute_import",
        expect.objectContaining({
          zipPath: "/tmp/backup.zip",
          selectedFiles: ["config.toml"],
        })
      )
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- src/__tests__/panels/MigratePanel.test.tsx
```

Expected: FAIL — `MigratePanel` component not found.

- [ ] **Step 3: Commit failing tests**

```bash
git add src/__tests__/panels/MigratePanel.test.tsx
git commit -m "test: add MigratePanel failing tests (TDD)"
```

---

## Task 7: MigratePanel component implementation

**Files:**
- Create: `src/components/panels/MigratePanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/panels/MigratePanel.tsx`:

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Commands, ImportFileInfo, ImportSummary } from "../../lib/tauri";
import { useUIStore } from "../../store";

const EXPORT_ITEMS = [
  "config",
  "memory",
  "skills",
  "history",
  "cron",
  "hooks",
] as const;
type ExportItem = (typeof EXPORT_ITEMS)[number];

export function MigratePanel() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<"export" | "import">("export");

  // Export state
  const [selectedItems, setSelectedItems] = useState<Set<ExportItem>>(
    new Set(EXPORT_ITEMS)
  );
  const [includeApiKeys, setIncludeApiKeys] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Import state
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportFileInfo[] | null>(
    null
  );
  const [fileSelections, setFileSelections] = useState<
    Record<string, boolean>
  >({});
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);

  // Derived step: 1=select file, 2=conflict list, 3=result
  const importStep = importResult ? 3 : importPreview ? 2 : 1;

  function toggleItem(item: ExportItem) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  async function handleExport() {
    const savePath = await save({
      defaultPath: "hermes-backup.zip",
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (!savePath) return;

    setExporting(true);
    try {
      await Commands.exportData(
        Array.from(selectedItems),
        includeApiKeys,
        savePath
      );
      showToast(`${t("migrate.exportSuccess")}: ${savePath}`, "success");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("migrate.exportFailed")}: ${msg}`, "error");
    } finally {
      setExporting(false);
    }
  }

  async function handleSelectFile() {
    const path = await open({
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (!path || typeof path !== "string") return;

    setZipPath(path);
    setPreviewing(true);
    try {
      const files = await Commands.previewImport(path);
      setImportPreview(files);
      const selections: Record<string, boolean> = {};
      for (const f of files) selections[f.path] = true;
      setFileSelections(selections);
    } catch {
      showToast(t("migrate.invalidZip"), "error");
      setZipPath(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!zipPath || !importPreview) return;
    const selected = Object.entries(fileSelections)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setImporting(true);
    try {
      const result = await Commands.executeImport(zipPath, selected);
      setImportResult(result);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
      showToast(`${t("migrate.importFailed")}: ${msg}`, "error");
    } finally {
      setImporting(false);
    }
  }

  function handleImportAgain() {
    setZipPath(null);
    setImportPreview(null);
    setFileSelections({});
    setImportResult(null);
  }

  function selectAll() {
    const next: Record<string, boolean> = {};
    for (const f of importPreview ?? []) next[f.path] = true;
    setFileSelections(next);
  }

  function deselectAll() {
    const next: Record<string, boolean> = {};
    for (const f of importPreview ?? []) next[f.path] = false;
    setFileSelections(next);
  }

  const conflictCount = importPreview?.filter((f) => f.hasConflict).length ?? 0;
  const selectedCount = Object.values(fileSelections).filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="bg-white rounded-[12px] p-1 shadow-[0_1px_4px_rgba(0,0,0,.06)] flex gap-1">
        {(["export", "import"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-[12px] font-[600] py-[7px] rounded-[9px] transition-colors ${
              activeTab === tab
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t(tab === "export" ? "migrate.exportTab" : "migrate.importTab")}
          </button>
        ))}
      </div>

      {/* Export tab */}
      {activeTab === "export" && (
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
            {t("migrate.section")}
          </div>

          <div className="space-y-2 mb-4">
            {EXPORT_ITEMS.map((item) => (
              <label
                key={item}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(item)}
                  onChange={() => toggleItem(item)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-[12px] text-text-primary font-[500]">
                  {t(`migrate.items.${item}`)}
                </span>
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={includeApiKeys}
              onChange={(e) => setIncludeApiKeys(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            <span className="text-[12px] text-text-secondary">
              {t("migrate.includeApiKeys")}
            </span>
          </label>

          <button
            onClick={handleExport}
            disabled={exporting || selectedItems.size === 0}
            className={`w-full text-[12px] font-[600] py-[9px] rounded-[9px] ${
              exporting || selectedItems.size === 0
                ? "bg-bg-secondary text-text-tertiary"
                : "bg-accent text-white"
            }`}
          >
            {exporting ? t("migrate.exporting") : t("migrate.export")}
          </button>
        </div>
      )}

      {/* Import tab */}
      {activeTab === "import" && (
        <div className="bg-white rounded-[12px] p-4 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
          <div className="text-[10px] text-text-tertiary font-[600] tracking-[.3px] uppercase mb-3">
            {t("migrate.section")}
          </div>

          {/* Step 1: Select file */}
          {importStep === 1 && (
            <button
              onClick={handleSelectFile}
              disabled={previewing}
              className={`w-full text-[12px] font-[600] py-[9px] rounded-[9px] ${
                previewing
                  ? "bg-bg-secondary text-text-tertiary"
                  : "bg-accent text-white"
              }`}
            >
              {previewing ? t("migrate.previewing") : t("migrate.selectFile")}
            </button>
          )}

          {/* Step 2: Conflict resolution */}
          {importStep === 2 && importPreview && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-text-secondary">
                  {conflictCount > 0
                    ? t("migrate.conflictsFound").replace(
                        "{count}",
                        String(conflictCount)
                      )
                    : t("migrate.noConflicts")}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-[11px] text-accent"
                  >
                    {t("migrate.selectAll")}
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-[11px] text-text-secondary"
                  >
                    {t("migrate.deselectAll")}
                  </button>
                </div>
              </div>

              <div className="space-y-1 mb-4 max-h-[200px] overflow-y-auto">
                {importPreview.map((file) => (
                  <label
                    key={file.path}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={fileSelections[file.path] ?? true}
                      onChange={(e) =>
                        setFileSelections((prev) => ({
                          ...prev,
                          [file.path]: e.target.checked,
                        }))
                      }
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="text-[11px] font-mono text-text-primary flex-1 truncate">
                      {file.path}
                    </span>
                    {file.hasConflict && (
                      <span className="text-[10px] text-orange-500 shrink-0">
                        {t("migrate.hasConflict")}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className={`w-full text-[12px] font-[600] py-[9px] rounded-[9px] ${
                  importing || selectedCount === 0
                    ? "bg-bg-secondary text-text-tertiary"
                    : "bg-accent text-white"
                }`}
              >
                {importing ? t("migrate.importing") : t("migrate.confirmImport")}
              </button>
            </>
          )}

          {/* Step 3: Result */}
          {importStep === 3 && importResult && (
            <>
              <div className="text-[13px] font-[600] text-text-primary mb-4">
                {t("migrate.importSuccess")
                  .replace("{imported}", String(importResult.imported))
                  .replace("{skipped}", String(importResult.skipped))}
              </div>
              <button
                onClick={handleImportAgain}
                className="w-full bg-bg-secondary text-text-primary text-[12px] font-[600] py-[9px] rounded-[9px]"
              >
                {t("migrate.importAgain")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm run test:run -- src/__tests__/panels/MigratePanel.test.tsx
```

Expected: `6 passed`.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass (previously passing tests not broken).

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/MigratePanel.tsx
git commit -m "feat: add MigratePanel component"
```

---

## Task 8: Wire MigratePanel into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import MigratePanel**

Open `src/App.tsx`. After the GatewayPanel import line:

```typescript
import { GatewayPanel } from "./components/panels/GatewayPanel";
```

Add:

```typescript
import { MigratePanel } from "./components/panels/MigratePanel";
```

- [ ] **Step 2: Replace PlaceholderPanel**

Find:

```typescript
{activePanel === "migrate" && <PlaceholderPanel />}
```

Replace with:

```typescript
{activePanel === "migrate" && <MigratePanel />}
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire MigratePanel into App"
```
