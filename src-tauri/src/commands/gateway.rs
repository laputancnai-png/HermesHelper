use serde::Serialize;
use std::path::{Path, PathBuf};

// ── Path helpers ──────────────────────────────────────────────────

fn env_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())
        .map(|h| h.join(".hermes").join(".env"))
}

fn pid_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())
        .map(|h| h.join(".hermes").join("gateway.pid"))
}

// ── Domain types ──────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    pub bot_token: String,
    pub allowed_users: String,
}

#[derive(Serialize)]
pub struct GatewayStatus {
    pub running: bool,
}

// ── Testable helpers ──────────────────────────────────────────────

pub(crate) fn get_gateway_config_from(env_path: &Path) -> Result<GatewayConfig, String> {
    if !env_path.exists() {
        return Ok(GatewayConfig {
            bot_token: String::new(),
            allowed_users: String::new(),
        });
    }
    let content =
        std::fs::read_to_string(env_path).map_err(|e| format!("Failed to read .env: {e}"))?;

    let mut bot_token = String::new();
    let mut allowed_users = String::new();

    for line in content.lines() {
        if let Some(val) = line.strip_prefix("TELEGRAM_BOT_TOKEN=") {
            bot_token = val.to_string();
        } else if let Some(val) = line.strip_prefix("TELEGRAM_ALLOWED_USERS=") {
            allowed_users = val.to_string();
        }
    }

    Ok(GatewayConfig {
        bot_token,
        allowed_users,
    })
}

pub(crate) fn save_gateway_config_to(
    env_path: &Path,
    config: &GatewayConfig,
) -> Result<(), String> {
    let existing = if env_path.exists() {
        std::fs::read_to_string(env_path).map_err(|e| format!("Failed to read .env: {e}"))?
    } else {
        String::new()
    };

    let mut lines: Vec<String> = existing
        .lines()
        .filter(|l| {
            !l.starts_with("TELEGRAM_BOT_TOKEN=") && !l.starts_with("TELEGRAM_ALLOWED_USERS=")
        })
        .map(String::from)
        .collect();

    lines.push(format!("TELEGRAM_BOT_TOKEN={}", config.bot_token));
    lines.push(format!("TELEGRAM_ALLOWED_USERS={}", config.allowed_users));

    if let Some(parent) = env_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    let content = lines.join("\n") + "\n";
    std::fs::write(env_path, content).map_err(|e| format!("Failed to write .env: {e}"))
}

pub(crate) fn get_gateway_status_from(pid_path: &Path) -> GatewayStatus {
    if !pid_path.exists() {
        return GatewayStatus { running: false };
    }
    let content = match std::fs::read_to_string(pid_path) {
        Ok(c) => c,
        Err(_) => return GatewayStatus { running: false },
    };
    let pid_str = content.trim().to_string();
    let running = std::process::Command::new("kill")
        .args(["-0", &pid_str])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    GatewayStatus { running }
}

// ── Tauri commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn get_gateway_config() -> Result<GatewayConfig, String> {
    get_gateway_config_from(&env_path()?)
}

#[tauri::command]
pub async fn save_gateway_config(bot_token: String, allowed_users: String) -> Result<(), String> {
    let config = GatewayConfig {
        bot_token,
        allowed_users,
    };
    save_gateway_config_to(&env_path()?, &config)
}

#[tauri::command]
pub async fn get_gateway_status() -> GatewayStatus {
    match pid_path() {
        Ok(p) => get_gateway_status_from(&p),
        Err(_) => GatewayStatus { running: false },
    }
}

#[tauri::command]
pub async fn start_gateway() -> Result<(), String> {
    tokio::process::Command::new("hermes")
        .args(["gateway", "run"])
        .spawn()
        .map_err(|e| format!("Failed to start gateway: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn stop_gateway() -> Result<(), String> {
    use std::time::Duration;

    // Try hermes gateway stop (timeout 10s)
    let result = tokio::time::timeout(
        Duration::from_secs(10),
        tokio::process::Command::new("hermes")
            .args(["gateway", "stop"])
            .status(),
    )
    .await;

    if let Ok(Ok(status)) = result {
        if status.success() {
            return Ok(());
        }
    }

    // Fallback: send SIGTERM via PID file
    let pid_file = pid_path()?;
    if pid_file.exists() {
        let content = tokio::fs::read_to_string(&pid_file)
            .await
            .map_err(|e| format!("Failed to read gateway.pid: {e}"))?;
        let pid_str = content.trim().to_string();
        std::process::Command::new("kill")
            .args(["-TERM", &pid_str])
            .spawn()
            .map_err(|e| format!("Failed to send SIGTERM: {e}"))?;
    }

    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_get_config_missing_file_returns_empty() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        let config = get_gateway_config_from(&path).unwrap();
        assert_eq!(config.bot_token, "");
        assert_eq!(config.allowed_users, "");
    }

    #[test]
    fn test_get_config_reads_token_from_env() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        std::fs::write(
            &path,
            "TELEGRAM_BOT_TOKEN=1234:ABC\nTELEGRAM_ALLOWED_USERS=111,222\n",
        )
        .unwrap();
        let config = get_gateway_config_from(&path).unwrap();
        assert_eq!(config.bot_token, "1234:ABC");
        assert_eq!(config.allowed_users, "111,222");
    }

    #[test]
    fn test_save_config_preserves_other_fields() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        std::fs::write(&path, "OTHER_VAR=keep_me\nTELEGRAM_BOT_TOKEN=old\n").unwrap();
        let config = GatewayConfig {
            bot_token: "new_token".to_string(),
            allowed_users: "42".to_string(),
        };
        save_gateway_config_to(&path, &config).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(
            content.contains("OTHER_VAR=keep_me"),
            "Other env vars must be preserved"
        );
        assert!(content.contains("TELEGRAM_BOT_TOKEN=new_token"));
        assert!(content.contains("TELEGRAM_ALLOWED_USERS=42"));
        assert!(!content.contains("TELEGRAM_BOT_TOKEN=old"));
    }

    #[test]
    fn test_save_config_creates_file_if_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        assert!(!path.exists());
        let config = GatewayConfig {
            bot_token: "tok".to_string(),
            allowed_users: "".to_string(),
        };
        save_gateway_config_to(&path, &config).unwrap();
        assert!(path.exists());
        let reloaded = get_gateway_config_from(&path).unwrap();
        assert_eq!(reloaded.bot_token, "tok");
    }

    #[test]
    fn test_get_status_no_pid_file_returns_not_running() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("gateway.pid");
        let status = get_gateway_status_from(&path);
        assert!(!status.running);
    }
}
