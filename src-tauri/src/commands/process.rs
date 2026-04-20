use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct DoctorResult {
    pub status: String, // "ok" | "warn" | "fail"
    pub message: String,
}

pub fn parse_doctor_line(line: &str) -> DoctorResult {
    let line = line.trim();
    if line.starts_with('✓') || line.starts_with("✓") {
        DoctorResult {
            status: "ok".into(),
            message: line.trim_start_matches('✓').trim().to_string(),
        }
    } else if line.starts_with('✗') || line.starts_with("✗") {
        DoctorResult {
            status: "fail".into(),
            message: line.trim_start_matches('✗').trim().to_string(),
        }
    } else {
        DoctorResult {
            status: "warn".into(),
            message: line
                .trim_start_matches('ℹ')
                .trim_start_matches("ℹ")
                .trim()
                .to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_recent_activity() -> Result<Vec<String>, String> {
    let log_path = dirs::home_dir()
        .unwrap_or_default()
        .join(".hermes/hermes.log");
    if !log_path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&log_path)
        .map_err(|e| format!("Failed to read log: {e}"))?;
    let lines: Vec<String> = content
        .lines()
        .rev()
        .take(10)
        .map(String::from)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    Ok(lines)
}

#[tauri::command]
pub async fn run_doctor() -> Result<Vec<DoctorResult>, String> {
    let output = Command::new("hermes")
        .arg("doctor")
        .output()
        .await
        .map_err(|e| format!("Failed to run hermes doctor: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let results = stdout
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(parse_doctor_line)
        .collect();

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_doctor_ok_line() {
        let result = parse_doctor_line("✓ hermes command available (v0.9.4)");
        assert_eq!(result.status, "ok");
        assert!(result.message.contains("hermes command"));
    }

    #[test]
    fn test_parse_doctor_warn_line() {
        let result = parse_doctor_line("ℹ voice module not installed (optional)");
        assert_eq!(result.status, "warn");
    }

    #[test]
    fn test_parse_doctor_fail_line() {
        let result = parse_doctor_line("✗ API key not configured");
        assert_eq!(result.status, "fail");
    }
}
