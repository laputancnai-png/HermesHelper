use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::Command;

const OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModelsResponse {
    models: Vec<ModelInfo>,
}

#[derive(Debug, Deserialize)]
struct ModelInfo {
    name: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    modified_at: String,
}

/// Check if Ollama service is running by hitting the models endpoint
#[tauri::command]
pub async fn check_ollama_status() -> Result<bool, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    match client
        .get(&format!("{}/api/tags", OLLAMA_BASE_URL))
        .send()
        .await
    {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Launch Ollama service in the background (macOS: homebrew installed)
#[tauri::command]
pub async fn start_ollama_service() -> Result<String, String> {
    // Try to start Ollama via launchctl (macOS homebrew)
    let output = Command::new("launchctl")
        .args(&["start", "homebrew.mxcl.ollama"])
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => {
            // Give it a moment to start up
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            Ok("Ollama 服务已启动".to_string())
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            Err(format!("启动失败: {}", stderr))
        }
        Err(e) => {
            // Fallback: try direct `ollama serve`
            eprintln!("launchctl failed, trying direct ollama serve: {}", e);
            match Command::new("ollama")
                .arg("serve")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
            {
                Ok(_) => {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    Ok("Ollama 服务已启动".to_string())
                }
                Err(e2) => Err(format!("无法启动 Ollama（请确保已安装）: {}", e2)),
            }
        }
    }
}

/// Fetch list of installed models from local Ollama instance
#[tauri::command]
pub async fn get_ollama_models() -> Result<Vec<OllamaModel>, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let resp = client
        .get(&format!("{}/api/tags", OLLAMA_BASE_URL))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Ollama 返回错误: {}",
            resp.status().as_str()
        ));
    }

    let data: ModelsResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse models response: {}", e))?;

    let models: Vec<OllamaModel> = data
        .models
        .into_iter()
        .map(|m| OllamaModel {
            name: m.name,
            size: if m.size > 0 { Some(m.size) } else { None },
            modified_at: if m.modified_at.is_empty() {
                None
            } else {
                Some(m.modified_at)
            },
        })
        .collect();

    Ok(models)
}

/// Format bytes to human-readable size
#[allow(dead_code)]
pub fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;

    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }

    if unit_idx == 0 {
        format!("{:.0} {}", size, UNITS[unit_idx])
    } else {
        format!("{:.1} {}", size, UNITS[unit_idx])
    }
}
