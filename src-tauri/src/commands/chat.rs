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

    let output = Command::new("hermes")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Hermes 未安装或无法启动: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // session_id may appear in stderr or stdout depending on Hermes version
    let sid = extract_session_id(&stderr)
        .or_else(|| extract_session_id(&stdout))
        .ok_or_else(|| format!("无法解析 session_id，原始输出: {}", stdout.trim()))?;

    // reply is always stdout (trimmed); if stdout is empty and exit failed, return error
    let reply = stdout.trim().to_string();
    if reply.is_empty() && !output.status.success() {
        let msg = if stderr.trim().is_empty() {
            "Hermes 返回错误".to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(msg);
    }

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
