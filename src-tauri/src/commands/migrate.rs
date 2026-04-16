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

            if path.is_symlink() {
                // skip symlinks to avoid traversal outside base_dir
            } else if path.is_file() {
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

// ── Import helpers ────────────────────────────────────────────────

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
}
