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
