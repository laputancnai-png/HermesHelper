use serde::{Deserialize, Serialize};
use std::path::PathBuf;
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

/// Strip ANSI escape codes so raw script output is readable in the UI log.
fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // Skip everything up to and including the final alphabetic character
            for ch in chars.by_ref() {
                if ch.is_ascii_alphabetic() {
                    break;
                }
            }
        } else if c != '\r' {
            out.push(c);
        }
    }
    out
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

/// Try to find the hermes binary without relying on the GUI app's PATH.
/// The install script puts it in ~/.local/bin/hermes on Linux/macOS.
fn hermes_binary_path() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let candidates = [
        home.join(".local/bin/hermes"),
        home.join(".hermes/bin/hermes"),
    ];
    for p in &candidates {
        if p.exists() {
            return Some(p.clone());
        }
    }
    // Fall back to PATH lookup
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
    // Try known install paths first (GUI app may not have updated PATH)
    if let Some(bin) = hermes_binary_path() {
        if let Ok(output) = Command::new(&bin).arg("--version").output().await {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            if let Some(v) = parse_version(&stdout) {
                return Ok(Some(v));
            }
        }
    }

    // Fall back to PATH
    match Command::new("hermes").arg("--version").output().await {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            Ok(parse_version(&stdout))
        }
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn install_hermes(window: tauri::Window) -> Result<(), String> {
    let install_url =
        "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh";

    // ── Step 1: download script ────────────────────────────────────────
    let emit = |line: &str, pct: u8| {
        window
            .emit("install_progress", InstallProgress { line: line.to_string(), pct })
            .ok();
    };

    emit("正在下载安装脚本...", 3);

    let tmp = std::env::temp_dir().join("hermes_install.sh");
    let dl = Command::new("curl")
        .args(["-fsSL", install_url, "-o", tmp.to_str().unwrap_or("/tmp/hermes_install.sh")])
        .output()
        .await
        .map_err(|e| format!("curl not found: {e}"))?;

    if !dl.status.success() {
        let err = String::from_utf8_lossy(&dl.stderr);
        let msg = format!("下载失败: {err}");
        window.emit("install_error", &msg).ok();
        return Err(msg);
    }

    emit("安装脚本下载完成，开始安装（这可能需要几分钟）...", 8);

    // ── Step 2: run script, capturing merged stdout+stderr ─────────────
    // CI=true  → most install scripts skip interactive prompts in CI environments
    // stdin null → script gets EOF on any stdin read, preventing TTY hangs
    let script_path = tmp.to_str().unwrap_or("/tmp/hermes_install.sh");
    let mut child = Command::new("bash")
        .args(["-c", &format!("bash {script_path} 2>&1")])
        .env("CI", "true")
        .env("HERMES_NON_INTERACTIVE", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to run installer: {e}"))?;

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let mut reader = BufReader::new(stdout).lines();
    let mut line_count: u8 = 8;

    while let Some(raw) = reader.next_line().await.map_err(|e| e.to_string())? {
        let line = strip_ansi(&raw);
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        line_count = line_count.saturating_add(1).min(95);
        window
            .emit(
                "install_progress",
                InstallProgress {
                    line: line.to_string(),
                    pct: line_count,
                },
            )
            .map_err(|e| e.to_string())?;
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;

    // Clean up temp script
    let _ = std::fs::remove_file(&tmp);

    if status.success() {
        window.emit("install_done", ()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        let msg = "安装失败，请查看上方日志".to_string();
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

    #[test]
    fn test_strip_ansi_removes_color_codes() {
        let input = "\x1b[32mSuccess\x1b[0m: installed";
        assert_eq!(strip_ansi(input), "Success: installed");
    }

    #[test]
    fn test_strip_ansi_removes_carriage_return() {
        let input = "line\r";
        assert_eq!(strip_ansi(input), "line");
    }

    #[test]
    fn test_strip_ansi_plain_text_unchanged() {
        let input = "Installing dependencies...";
        assert_eq!(strip_ansi(input), "Installing dependencies...");
    }
}
