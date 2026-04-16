use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
    pub os_version: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct InstallProgress {
    pub line: String,
    pub pct: u8,
}

fn parse_version(output: &str) -> Option<String> {
    for line in output.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("hermes ") {
            let version = rest.split_whitespace().next()?;
            return Some(version.to_string());
        }
    }
    None
}

#[tauri::command]
pub async fn detect_platform() -> Result<PlatformInfo, String> {
    let os = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    };
    let arch = std::env::consts::ARCH.to_string();
    Ok(PlatformInfo {
        os: os.to_string(),
        arch,
        os_version: String::new(),
    })
}

#[tauri::command]
pub async fn check_hermes_version() -> Result<Option<String>, String> {
    let output = Command::new("hermes")
        .arg("--version")
        .output()
        .await
        .map_err(|_| "hermes not found".to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(parse_version(&stdout))
}

#[tauri::command]
pub async fn install_hermes(window: tauri::Window) -> Result<(), String> {
    let install_url =
        "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh";

    // Merge stderr into stdout (2>&1) so all installer output is captured.
    let mut child = Command::new("bash")
        .args(["-c", &format!("curl -fsSL {install_url} | bash 2>&1")])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start installer: {e}"))?;

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let mut reader = BufReader::new(stdout).lines();
    let mut line_count: u8 = 0;

    while let Some(line) = reader.next_line().await.map_err(|e| e.to_string())? {
        line_count = line_count.saturating_add(2).min(95);
        window
            .emit(
                "install_progress",
                InstallProgress {
                    line: line.clone(),
                    pct: line_count,
                },
            )
            .map_err(|e| e.to_string())?;
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if status.success() {
        window.emit("install_done", ()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        let msg = "Installation failed — check logs above".to_string();
        window.emit("install_error", &msg).map_err(|e| e.to_string())?;
        Err(msg)
    }
}

#[tauri::command]
pub async fn uninstall_hermes() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;

    let hermes_dir = home.join(".hermes");
    if hermes_dir.exists() {
        std::fs::remove_dir_all(&hermes_dir)
            .map_err(|e| format!("Failed to remove ~/.hermes: {e}"))?;
    }

    for bin_path in [
        home.join(".local/bin/hermes"),
        home.join(".hermes/bin/hermes"),
    ] {
        if bin_path.exists() {
            std::fs::remove_file(&bin_path)
                .map_err(|e| format!("Failed to remove binary: {e}"))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version_from_output() {
        let output = "hermes 0.9.4\nsome other line";
        let version = parse_version(output);
        assert_eq!(version, Some("0.9.4".to_string()));
    }

    #[test]
    fn test_parse_version_missing() {
        let output = "command not found";
        let version = parse_version(output);
        assert_eq!(version, None);
    }
}
