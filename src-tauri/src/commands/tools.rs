use std::path::{Path, PathBuf};

fn cli_config_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())
        .map(|h| h.join(".hermes").join("cli-config.yaml"))
}

pub(crate) const ALL_KNOWN_TOOLSETS: &[&str] = &[
    "terminal",
    "file",
    "web",
    "memory",
    "skills",
    "todo",
    "cronjob",
    "browser",
    "vision",
    "image_gen",
    "tts",
    "moa",
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
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    let content = serde_yaml::to_string(&value).map_err(|e| format!("Failed to serialize: {e}"))?;
    std::fs::write(path, content).map_err(|e| format!("Failed to write cli-config.yaml: {e}"))
}

#[tauri::command]
pub async fn get_tools() -> Result<Vec<String>, String> {
    get_tools_from(&cli_config_path()?)
}

#[tauri::command]
pub async fn save_tools(toolsets: Vec<String>) -> Result<(), String> {
    for t in &toolsets {
        if !ALL_KNOWN_TOOLSETS.contains(&t.as_str()) {
            return Err(format!("Unknown toolset: {t}"));
        }
    }
    save_tools_to(&cli_config_path()?, &toolsets)
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
        assert!(
            content.contains("claude-opus"),
            "model field must be preserved"
        );
        let loaded = get_tools_from(&path).unwrap();
        assert_eq!(loaded, vec!["terminal", "file"]);
    }
}
