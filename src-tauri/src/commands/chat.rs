use serde::Serialize;
use tokio::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatReply {
    pub reply: String,
    pub session_id: String,
}

fn parse_hermes_output(raw: &str) -> (String, String) {
    let mut session_id = String::new();
    let mut reply_lines: Vec<&str> = Vec::new();
    let mut found = false;

    for line in raw.lines() {
        if !found {
            if let Some(id) = line.strip_prefix("session_id: ") {
                session_id = id.trim().to_string();
                found = true;
            }
            // skip lines before session_id (e.g. "↻ Resumed session ...")
        } else {
            reply_lines.push(line);
        }
    }

    let reply = reply_lines.join("\n").trim().to_string();
    (reply, session_id)
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

    if !output.status.success() && stdout.trim().is_empty() {
        let msg = if stderr.is_empty() {
            "Hermes 返回错误".to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(msg);
    }

    let (reply, sid) = parse_hermes_output(&stdout);

    if sid.is_empty() {
        return Err(format!(
            "无法解析 session_id，原始输出: {}",
            stdout.trim()
        ));
    }

    Ok(ChatReply {
        reply,
        session_id: sid,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_new_session() {
        let raw = "session_id: abc123\nHello, world!";
        let (reply, id) = parse_hermes_output(raw);
        assert_eq!(id, "abc123");
        assert_eq!(reply, "Hello, world!");
    }

    #[test]
    fn test_parse_resumed_session() {
        let raw = "↻ Resumed session abc123 (2 messages)\n\nsession_id: abc123\nHi again!";
        let (reply, id) = parse_hermes_output(raw);
        assert_eq!(id, "abc123");
        assert_eq!(reply, "Hi again!");
    }

    #[test]
    fn test_parse_multiline_reply() {
        let raw = "session_id: xyz\nLine one\nLine two\nLine three";
        let (reply, id) = parse_hermes_output(raw);
        assert_eq!(id, "xyz");
        assert_eq!(reply, "Line one\nLine two\nLine three");
    }

    #[test]
    fn test_parse_missing_session_id() {
        let raw = "some unexpected output";
        let (reply, id) = parse_hermes_output(raw);
        assert_eq!(id, "");
        assert_eq!(reply, "");
    }
}
