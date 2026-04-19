use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Duration;

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BotInfo {
    pub username: String,
    pub first_name: String,
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
    // Primary: check pid file (may be plain number or JSON {"pid": N, ...})
    if pid_path.exists() {
        if let Ok(content) = std::fs::read_to_string(pid_path) {
            if let Some(pid) = extract_pid_from_content(content.trim()) {
                let alive = std::process::Command::new("kill")
                    .args(["-0", &pid.to_string()])
                    .status()
                    .map(|s| s.success())
                    .unwrap_or(false);
                if alive {
                    return GatewayStatus { running: true };
                }
            }
        }
    }
    // Fallback: pgrep for any "hermes gateway" process
    let running = std::process::Command::new("pgrep")
        .args(["-f", "hermes gateway"])
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
    // Ensure open access is enabled before starting.
    if let Ok(p) = env_path() { ensure_allow_all_users(&p); }

    // Step 1: kill ALL hermes gateway processes (launchd-managed AND app-spawned).
    // pgrep -f matches any process whose argv contains "hermes" and "gateway".
    kill_all_gateway_processes().await;

    // Step 2: start via service manager (launchd/systemd).
    // "start" is preferred over "restart" since we already killed everything.
    let result = tokio::time::timeout(
        Duration::from_secs(12),
        tokio::process::Command::new("hermes")
            .args(["gateway", "start"])
            .status(),
    )
    .await;

    if let Ok(Ok(status)) = result {
        if status.success() {
            return Ok(());
        }
    }

    // Fallback: run in foreground (e.g. service not installed)
    tokio::process::Command::new("hermes")
        .args(["gateway", "run"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start gateway: {e}"))?;

    Ok(())
}

fn ensure_allow_all_users(env_path: &Path) {
    let existing = std::fs::read_to_string(env_path).unwrap_or_default();
    let already_true = existing.lines().any(|l| l.trim() == "GATEWAY_ALLOW_ALL_USERS=true");
    if already_true { return; }
    // Replace any existing (possibly commented or false) line, or append.
    let new_lines: Vec<&str> = existing
        .lines()
        .filter(|l| !l.trim_start_matches('#').trim().starts_with("GATEWAY_ALLOW_ALL_USERS="))
        .collect();
    let mut new_content = new_lines.join("\n");
    new_content.push_str("\nGATEWAY_ALLOW_ALL_USERS=true\n");
    let _ = std::fs::write(env_path, new_content);
}

async fn kill_all_gateway_processes() {
    // Collect all PIDs matching "hermes.*gateway" before killing any of them
    let Ok(out) = std::process::Command::new("pgrep")
        .args(["-f", "hermes.*gateway"])
        .output()
    else { return; };

    let pids: Vec<String> = String::from_utf8_lossy(&out.stdout)
        .split_whitespace()
        .map(String::from)
        .collect();

    if pids.is_empty() { return; }

    // SIGTERM first
    for pid in &pids {
        let _ = std::process::Command::new("kill").args(["-TERM", pid]).status();
    }
    tokio::time::sleep(Duration::from_millis(1200)).await;

    // SIGKILL any survivors
    for pid in &pids {
        let alive = std::process::Command::new("kill")
            .args(["-0", pid])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if alive {
            let _ = std::process::Command::new("kill").args(["-KILL", pid]).status();
        }
    }
    tokio::time::sleep(Duration::from_millis(400)).await;
}

/// Extract numeric PID from either a plain number string or JSON like {"pid": 12345, ...}
fn extract_pid_from_content(content: &str) -> Option<u32> {
    // Plain number
    if let Ok(n) = content.parse::<u32>() {
        return Some(n);
    }
    // JSON object — find "pid": <number>
    let key = "\"pid\":";
    if let Some(pos) = content.find(key) {
        let after = content[pos + key.len()..].trim_start();
        let num_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        return num_str.parse::<u32>().ok();
    }
    None
}

#[tauri::command]
pub async fn approve_pairing(platform: String, code: String) -> Result<(), String> {
    let output = tokio::process::Command::new("hermes")
        .args(["pairing", "approve", &platform, &code])
        .output()
        .await
        .map_err(|e| format!("Failed to run hermes: {e}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Err(if !stderr.is_empty() { stderr } else { stdout })
    }
}

#[tauri::command]
pub async fn verify_bot_token(token: String) -> Result<BotInfo, String> {
    let url = format!("https://api.telegram.org/bot{}/getMe", token);
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("网络错误: {e}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析失败: {e}"))?;

    if !resp["ok"].as_bool().unwrap_or(false) {
        return Err(resp["description"]
            .as_str()
            .unwrap_or("Token 无效")
            .to_string());
    }

    let r = &resp["result"];
    Ok(BotInfo {
        username: r["username"].as_str().unwrap_or("").to_string(),
        first_name: r["first_name"].as_str().unwrap_or("").to_string(),
    })
}

#[tauri::command]
pub async fn stop_gateway() -> Result<(), String> {
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

    // Fallback: parse PID from pid file (may be JSON) and send SIGTERM
    let pid_file = pid_path()?;
    if pid_file.exists() {
        if let Ok(content) = tokio::fs::read_to_string(&pid_file).await {
            if let Some(pid) = extract_pid_from_content(content.trim()) {
                let _ = std::process::Command::new("kill")
                    .args(["-TERM", &pid.to_string()])
                    .status();
            }
        }
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
