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
        let lower = line.to_lowercase();
        // Matches: "hermes 0.9.4", "Hermes Agent v0.10.0 ..."
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

fn hermes_binary_path_for_home(home: &PathBuf) -> Option<PathBuf> {
    let candidates = [
        home.join(".local/bin/hermes"),
        home.join(".hermes/bin/hermes"),
    ];
    candidates.into_iter().find(|p| p.exists())
}

/// Try to find the hermes binary without relying on the GUI app's PATH.
fn hermes_binary_path() -> Option<PathBuf> {
    hermes_binary_path_for_home(&dirs::home_dir()?)
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

    // ── Step 2: run script ────────────────────────────────────────────────
    // The Hermes install script ends with an interactive setup wizard (using a
    // TUI library that reads /dev/tty directly, so stdin tricks don't work).
    // Strategy: stream output line-by-line; as soon as the hermes binary
    // appears at ~/.local/bin/hermes, kill the script and declare success —
    // the wizard is post-install config, the core install is already done.
    let script_path = tmp.to_str().unwrap_or("/tmp/hermes_install.sh");
    let mut child = Command::new("bash")
        .args([script_path])
        .env("CI", "true")
        .env("HERMES_NON_INTERACTIVE", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run installer: {e}"))?;

    let binary_path = hermes_binary_path_for_home(
        &dirs::home_dir().unwrap_or_default()
    );

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;

    // Merge stderr into stdout via a spawned task
    let win2 = window.clone();
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(raw)) = reader.next_line().await {
            let line = strip_ansi(&raw);
            let line = line.trim().to_string();
            if !line.is_empty() {
                win2.emit("install_progress", InstallProgress { line, pct: 0 }).ok();
            }
        }
    });

    let mut reader = BufReader::new(stdout).lines();
    let mut wizard_started = false;

    loop {
        // Check binary existence before blocking on next line
        if binary_path.as_ref().map(|p| p.exists()).unwrap_or(false) {
            emit("✅ Hermes 安装成功，正在关闭安装向导...", 0);
            child.kill().await.ok();
            break;
        }

        match reader.next_line().await {
            Ok(Some(raw)) => {
                let line = strip_ansi(&raw);
                let line = line.trim().to_string();
                if line.is_empty() { continue; }

                // Detect wizard start — binary should be present shortly after
                if line.contains("Setup Wizard") || line.contains("setup wizard") {
                    wizard_started = true;
                }

                window.emit("install_progress", InstallProgress { line, pct: 0 })
                    .map_err(|e| e.to_string())?;

                // If wizard started and binary now exists, we're done
                if wizard_started && binary_path.as_ref().map(|p| p.exists()).unwrap_or(false) {
                    emit("✅ Hermes 安装成功，正在关闭安装向导...", 0);
                    child.kill().await.ok();
                    break;
                }
            }
            Ok(None) => break, // EOF — script finished on its own
            Err(e) => return Err(e.to_string()),
        }
    }

    stderr_task.abort();
    let _ = child.wait().await;
    let _ = std::fs::remove_file(&tmp);

    // Final check: did we actually get the binary?
    if binary_path.as_ref().map(|p| p.exists()).unwrap_or(false) {
        window.emit("install_done", ()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        let msg = "安装失败，未找到 hermes 可执行文件".to_string();
        window.emit("install_error", &msg).map_err(|e| e.to_string())?;
        Err(msg)
    }
}

#[tauri::command]
pub async fn uninstall_hermes() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;

    // Use `rm -rf` for reliable removal (handles symlinks, special files, etc.)
    let hermes_dir = home.join(".hermes");
    if hermes_dir.exists() || hermes_dir.symlink_metadata().is_ok() {
        let status = Command::new("rm")
            .args(["-rf", hermes_dir.to_str().unwrap_or("")])
            .status()
            .await
            .map_err(|e| format!("Failed to run rm: {e}"))?;
        if !status.success() {
            return Err("Failed to remove ~/.hermes directory".into());
        }
    }

    // Remove binary symlink/file
    let bin_path = home.join(".local/bin/hermes");
    if bin_path.exists() || bin_path.symlink_metadata().is_ok() {
        std::fs::remove_file(&bin_path)
            .map_err(|e| format!("Failed to remove binary: {e}"))?;
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
    fn test_parse_version_hermes_agent_format() {
        let output = "Hermes Agent v0.10.0 (2026.4.16)\nProject: /Users/foo/.hermes/hermes-agent";
        let version = parse_version(output);
        assert_eq!(version, Some("v0.10.0".to_string()));
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
