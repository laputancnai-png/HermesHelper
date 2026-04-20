// src-tauri/src/commands/status.rs
use serde::Serialize;
use tokio::process::Command;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HermesStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub running: bool,
}

fn parse_version(output: &str) -> Option<String> {
    for line in output.lines() {
        let lower = line.trim().to_lowercase();
        if lower.starts_with("hermes") {
            for token in line.split_whitespace() {
                let t = token.trim_start_matches('v');
                if t.contains('.') && t.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                    return Some(token.to_string());
                }
            }
        }
    }
    None
}

fn hermes_bin() -> Option<std::path::PathBuf> {
    let home = dirs::home_dir()?;
    [home.join(".local/bin/hermes"), home.join(".hermes/bin/hermes")]
        .into_iter()
        .find(|p| p.exists())
}

#[tauri::command]
pub async fn get_hermes_status() -> Result<HermesStatus, String> {
    let bin = hermes_bin();
    let installed = bin.is_some();

    if !installed {
        return Ok(HermesStatus { installed: false, version: None, running: false });
    }

    let bin = bin.unwrap();
    let version = Command::new(&bin)
        .arg("--version")
        .output()
        .await
        .ok()
        .and_then(|o| parse_version(&String::from_utf8_lossy(&o.stdout)));

    // Check if a hermes process is running
    let running = Command::new("pgrep")
        .args(["-f", "hermes"])
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false);

    Ok(HermesStatus { installed, version, running })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version_hermes_agent_format() {
        let out = "Hermes Agent v0.10.0 (2026.4.16)\nProject: /Users/foo/.hermes";
        assert_eq!(parse_version(out), Some("v0.10.0".to_string()));
    }

    #[test]
    fn test_parse_version_missing() {
        assert_eq!(parse_version("command not found"), None);
    }

    #[test]
    fn test_parse_version_plain_string() {
        assert_eq!(parse_version("hermes 0.9.4"), Some("0.9.4".to_string()));
    }
}
