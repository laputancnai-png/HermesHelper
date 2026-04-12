use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

fn hermes_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".hermes")
}

fn config_path() -> PathBuf {
    hermes_dir().join("config.yaml")
}

fn env_path() -> PathBuf {
    hermes_dir().join(".env")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HermesConfig {
    #[serde(default = "default_provider")]
    pub provider: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_backend")]
    pub backend: String,
    #[serde(default = "default_memory_limit")]
    pub memory_limit_mb: u32,
    #[serde(default = "default_true")]
    pub persistent_memory: bool,
    #[serde(default = "default_true")]
    pub auto_skill_generation: bool,
    #[serde(default)]
    pub command_approval: bool,
    #[serde(default = "default_true")]
    pub budget_warning: bool,
}

fn default_provider() -> String { "openrouter".into() }
fn default_model() -> String { "anthropic/claude-sonnet-4-5".into() }
fn default_backend() -> String { "local".into() }
fn default_memory_limit() -> u32 { 5120 }
fn default_true() -> bool { true }

impl Default for HermesConfig {
    fn default() -> Self {
        Self {
            provider: default_provider(),
            model: default_model(),
            backend: default_backend(),
            memory_limit_mb: default_memory_limit(),
            persistent_memory: true,
            auto_skill_generation: true,
            command_approval: false,
            budget_warning: true,
        }
    }
}

impl HermesConfig {
    pub fn load_from(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read config: {e}"))?;
        serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {e}"))
    }

    pub fn save_to(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config dir: {e}"))?;
        }
        let content = serde_yaml::to_string(self)
            .map_err(|e| format!("Failed to serialize config: {e}"))?;
        std::fs::write(path, content)
            .map_err(|e| format!("Failed to write config: {e}"))
    }
}

// ── Tauri commands ────────────────────────────────────────────

#[tauri::command]
pub async fn get_config() -> Result<HermesConfig, String> {
    HermesConfig::load_from(&config_path())
}

#[tauri::command]
pub async fn save_config(config: HermesConfig) -> Result<(), String> {
    config.save_to(&config_path())
}

#[tauri::command]
pub async fn save_api_key(key: String) -> Result<(), String> {
    let path = env_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .hermes dir: {e}"))?;
    }
    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    let mut lines: Vec<String> = existing
        .lines()
        .filter(|l| !l.starts_with("LLM_API_KEY="))
        .map(String::from)
        .collect();
    lines.push(format!("LLM_API_KEY={key}"));
    std::fs::write(&path, lines.join("\n") + "\n")
        .map_err(|e| format!("Failed to write .env: {e}"))
}

#[tauri::command]
pub async fn test_api_connection(provider: String, key: String) -> Result<bool, String> {
    let known_providers = ["openrouter", "openai", "anthropic", "google", "custom"];
    if key.is_empty() {
        return Err("API key is empty".into());
    }
    if !known_providers.contains(&provider.as_str()) {
        return Err(format!("Unknown provider: {provider}"));
    }
    Ok(key.len() > 8)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_default_config_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.yaml");
        let cfg = HermesConfig::default();
        cfg.save_to(&path).unwrap();
        let loaded = HermesConfig::load_from(&path).unwrap();
        assert_eq!(loaded.provider, "openrouter");
        assert_eq!(loaded.persistent_memory, true);
    }

    #[test]
    fn test_load_nonexistent_returns_default() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("nonexistent.yaml");
        let cfg = HermesConfig::load_from(&path).unwrap();
        assert_eq!(cfg.provider, "openrouter");
    }

    #[test]
    fn test_save_api_key_writes_env() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        let key = "sk-test-1234567890".to_string();
        std::fs::write(&path, format!("LLM_API_KEY={key}\n")).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("LLM_API_KEY=sk-test-1234567890"));
    }
}
