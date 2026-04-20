use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::Command;
use tokio::time::{sleep, Duration};

const OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434";

fn command_output_text(output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stderr.is_empty() {
        return stderr;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stdout.is_empty() {
        return stdout;
    }
    "无输出".to_string()
}

async fn wait_for_ollama_ready(max_retries: usize, interval_ms: u64) -> bool {
    for _ in 0..max_retries {
        if is_ollama_running().await {
            return true;
        }
        sleep(Duration::from_millis(interval_ms)).await;
    }
    false
}

async fn is_ollama_running() -> bool {
    let client = match Client::builder().timeout(Duration::from_secs(2)).build() {
        Ok(c) => c,
        Err(_) => return false,
    };

    match client
        .get(&format!("{}/api/tags", OLLAMA_BASE_URL))
        .send()
        .await
    {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

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
    Ok(is_ollama_running().await)
}

/// Launch Ollama service in the background (macOS: homebrew installed)
#[tauri::command]
pub async fn start_ollama_service() -> Result<String, String> {
    if is_ollama_running().await {
        return Ok("Ollama 已在运行".to_string());
    }

    let mut attempts: Vec<String> = Vec::new();

    // Strategy 1: brew services start ollama
    match Command::new("brew")
        .args(["services", "start", "ollama"])
        .output()
        .await
    {
        Ok(out) if out.status.success() => {
            if wait_for_ollama_ready(16, 500).await {
                return Ok("Ollama 服务已启动".to_string());
            }
            attempts.push("brew services start ollama 成功执行，但端口 11434 未就绪".to_string());
        }
        Ok(out) => {
            attempts.push(format!(
                "brew services start ollama 失败: {}",
                command_output_text(&out)
            ));
        }
        Err(e) => {
            attempts.push(format!("brew 不可用或执行失败: {}", e));
        }
    }

    // Strategy 2: launchctl for Homebrew service label
    match Command::new("launchctl")
        .args(["start", "homebrew.mxcl.ollama"])
        .output()
        .await
    {
        Ok(out) if out.status.success() => {
            if wait_for_ollama_ready(16, 500).await {
                return Ok("Ollama 服务已启动".to_string());
            }
            attempts.push("launchctl start 成功执行，但端口 11434 未就绪".to_string());
        }
        Ok(out) => {
            attempts.push(format!(
                "launchctl start homebrew.mxcl.ollama 失败: {}",
                command_output_text(&out)
            ));
        }
        Err(e) => {
            attempts.push(format!("launchctl 不可用或执行失败: {}", e));
        }
    }

    // Strategy 3: start macOS app if installed
    match Command::new("open")
        .args(["-a", "Ollama"])
        .output()
        .await
    {
        Ok(out) if out.status.success() => {
            if wait_for_ollama_ready(16, 500).await {
                return Ok("Ollama 服务已启动".to_string());
            }
            attempts.push("open -a Ollama 成功执行，但端口 11434 未就绪".to_string());
        }
        Ok(out) => {
            attempts.push(format!("open -a Ollama 失败: {}", command_output_text(&out)));
        }
        Err(e) => {
            attempts.push(format!("open 命令执行失败: {}", e));
        }
    }

    // Strategy 4: direct process spawn
    match Command::new("ollama")
        .arg("serve")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(_) => {
            if wait_for_ollama_ready(16, 500).await {
                return Ok("Ollama 服务已启动".to_string());
            }
            attempts.push("ollama serve 已启动进程，但端口 11434 未就绪".to_string());
        }
        Err(e) => {
            attempts.push(format!("ollama serve 启动失败: {}", e));
        }
    }

    Err(format!(
        "无法启动 Ollama。请手动运行 `ollama serve` 后重试。诊断信息: {}",
        attempts.join(" | ")
    ))
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
