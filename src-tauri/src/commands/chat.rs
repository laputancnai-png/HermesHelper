use serde::Serialize;
use tokio::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatReply {
    pub reply: String,
    pub session_id: String,
}

/// Extract session_id from any text (stdout or stderr).
/// Returns the first matching "session_id: <id>" line value.
fn extract_session_id(text: &str) -> Option<String> {
    text.lines()
        .find_map(|line| line.strip_prefix("session_id: ").map(|id| id.trim().to_string()))
        .filter(|id| !id.is_empty())
}

#[tauri::command]
pub async fn hermes_chat(
    message: String,
    session_id: Option<String>,
) -> Result<ChatReply, String> {
    let mut args = vec![
        "chat".to_string(),
        "-q".to_string(),
        message,
        "-Q".to_string(),
        "--source".to_string(),
        "tool".to_string(),
    ];
    if let Some(ref id) = session_id {
        if !id.is_empty() {
            args.push("--resume".to_string());
            args.push(id.clone());
        }
    }

    // macOS GUI apps don't inherit the shell PATH; augment with common install locations.
    let path_env = {
        let current = std::env::var("PATH").unwrap_or_default();
        let home = std::env::var("HOME").unwrap_or_default();
        let extras = format!(
            "/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:{home}/.local/bin:/usr/local/sbin"
        );
        format!("{extras}:{current}")
    };

    let output = Command::new("hermes")
        .args(&args)
        .env("PATH", &path_env)
        .output()
        .await
        .map_err(|e| format!("Hermes 未安装或无法启动: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // If Hermes exited with error, surface the original error first.
    if !output.status.success() {
        let msg = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else if !stdout.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            "Hermes 返回错误".to_string()
        };
        return Err(msg);
    }

    // session_id may appear in stderr or stdout depending on Hermes version
    let sid = extract_session_id(&stderr)
        .or_else(|| extract_session_id(&stdout))
        .ok_or_else(|| {
            let raw = if !stderr.trim().is_empty() {
                stderr.trim()
            } else {
                stdout.trim()
            };
            format!("无法解析 session_id，原始输出: {raw}")
        })?;

    // Reply comes from stdout, but older Hermes may include a leading
    // "session_id: ..." line there. Strip that metadata line.
    let reply = stdout
        .lines()
        .filter(|line| !line.trim_start().starts_with("session_id:"))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    Ok(ChatReply { reply, session_id: sid })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_id_from_stderr() {
        let stderr = "\nsession_id: abc123\n";
        assert_eq!(extract_session_id(stderr), Some("abc123".into()));
    }

    #[test]
    fn test_session_id_from_stdout() {
        let stdout = "session_id: xyz789\nHello!";
        assert_eq!(extract_session_id(stdout), Some("xyz789".into()));
    }

    #[test]
    fn test_session_id_missing() {
        let text = "Hello! How can I assist you today?";
        assert_eq!(extract_session_id(text), None);
    }

    #[test]
    fn test_session_id_with_resumed_prefix() {
        let stderr = "↻ Resumed session abc123 (2 messages)\n\nsession_id: abc123\n";
        assert_eq!(extract_session_id(stderr), Some("abc123".into()));
    }
}
