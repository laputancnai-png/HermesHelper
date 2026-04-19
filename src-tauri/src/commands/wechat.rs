use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeChatSetupProgress {
    pub line: String,
    pub phase: String,
    pub qr_url: Option<String>,
}

#[derive(Deserialize)]
struct QrEvent {
    #[serde(rename = "type")]
    kind: String,
    url: Option<String>,
    value: Option<String>,
    msg: Option<String>,
}

fn hermes_agent_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".hermes").join("hermes-agent"))
}

fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            for ch in chars.by_ref() {
                if ch.is_ascii_alphabetic() { break; }
            }
        } else if c != '\r' {
            out.push(c);
        }
    }
    out
}

#[tauri::command]
pub async fn check_wechat_deps() -> bool {
    let Some(agent_dir) = hermes_agent_dir() else { return false; };
    let venv_python = agent_dir.join("venv").join("bin").join("python");
    let result = Command::new(&venv_python)
        .args(["-c", "import aiohttp, cryptography; print('ok')"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;
    match result {
        Ok(output) => String::from_utf8_lossy(&output.stdout).trim() == "ok",
        Err(_) => false,
    }
}

#[tauri::command]
pub async fn install_wechat_deps(window: tauri::Window) -> Result<(), String> {
    let Some(agent_dir) = hermes_agent_dir() else {
        let msg = "找不到 ~/.hermes/hermes-agent 目录".to_string();
        window.emit("wechat_setup_error", &msg).ok();
        return Err(msg);
    };

    let venv_python = agent_dir.join("venv").join("bin").join("python");
    let mut child = Command::new(&venv_python)
        .args(["-m", "pip", "install", "--quiet", "aiohttp", "cryptography"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run pip: {e}"))?;

    let emit_line = {
        let window = window.clone();
        move |line: String| {
            window.emit("wechat_setup_progress", WeChatSetupProgress {
                line,
                phase: "deps_installing".to_string(),
                qr_url: None,
            }).ok();
        }
    };

    if let Some(stderr) = child.stderr.take() {
        let emit2 = emit_line.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(raw)) = reader.next_line().await {
                let line = strip_ansi(&raw).trim().to_string();
                if !line.is_empty() { emit2(line); }
            }
        });
    }

    if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout).lines();
        loop {
            match reader.next_line().await {
                Ok(Some(raw)) => {
                    let line = strip_ansi(&raw).trim().to_string();
                    if !line.is_empty() { emit_line(line); }
                }
                Ok(None) => break,
                Err(e) => {
                    let msg = e.to_string();
                    window.emit("wechat_setup_error", &msg).ok();
                    return Err(msg);
                }
            }
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if status.success() {
        window.emit("wechat_setup_done", ()).ok();
        Ok(())
    } else {
        let msg = "pip install 失败".to_string();
        window.emit("wechat_setup_error", &msg).ok();
        Err(msg)
    }
}

/// Check if WeChat credentials have been saved.
/// Returns true if ~/.hermes/weixin/accounts/ exists and has at least one file.
#[tauri::command]
pub async fn check_wechat_credentials() -> bool {
    let Some(home) = dirs::home_dir() else { return false; };
    let accounts_dir = home.join(".hermes").join("weixin").join("accounts");
    match tokio::fs::read_dir(&accounts_dir).await {
        Ok(mut entries) => entries.next_entry().await.ok().flatten().is_some(),
        Err(_) => false,
    }
}

// Python script that directly calls the weixin iLink API and streams JSON-line events.
// Bypasses `hermes gateway setup` entirely — no TUI, no CLI parsing.
const WEIXIN_LOGIN_SCRIPT: &str = r#"
import asyncio, json, sys, os, time
sys.path.insert(0, os.path.expanduser("~/.hermes/hermes-agent"))
os.chdir(os.path.expanduser("~/.hermes/hermes-agent"))

def emit(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)

async def main():
    try:
        import aiohttp
        from gateway.platforms.weixin import (
            _api_get, _make_ssl_connector, save_weixin_account,
            ILINK_BASE_URL, EP_GET_BOT_QR, EP_GET_QR_STATUS,
            QR_TIMEOUT_MS,
        )
        from hermes_constants import get_hermes_home
    except Exception as e:
        emit({"type": "error", "msg": f"import error: {e}"})
        return

    hermes_home = get_hermes_home()

    async with aiohttp.ClientSession(
        trust_env=True, connector=_make_ssl_connector()
    ) as session:
        # ── Step 1: fetch QR code ─────────────────────────────────
        try:
            qr_resp = await _api_get(
                session,
                base_url=ILINK_BASE_URL,
                endpoint=f"{EP_GET_BOT_QR}?bot_type=3",
                timeout_ms=QR_TIMEOUT_MS,
            )
        except Exception as e:
            emit({"type": "error", "msg": f"获取二维码失败: {e}"})
            return

        qrcode_value = str(qr_resp.get("qrcode") or "")
        qrcode_url   = str(qr_resp.get("qrcode_img_content") or "")
        if not qrcode_value:
            emit({"type": "error", "msg": "二维码响应格式异常"})
            return

        qr_scan_data = qrcode_url if qrcode_url else qrcode_value
        emit({"type": "qr", "url": qr_scan_data})

        # ── Step 2: poll for scan status ──────────────────────────
        deadline        = time.time() + 480
        current_base    = ILINK_BASE_URL
        refresh_count   = 0

        while time.time() < deadline:
            try:
                status_resp = await _api_get(
                    session,
                    base_url=current_base,
                    endpoint=f"{EP_GET_QR_STATUS}?qrcode={qrcode_value}",
                    timeout_ms=QR_TIMEOUT_MS,
                )
            except asyncio.TimeoutError:
                await asyncio.sleep(1)
                continue
            except Exception as e:
                emit({"type": "log", "msg": f"轮询出错，重试中: {e}"})
                await asyncio.sleep(1)
                continue

            status = str(status_resp.get("status") or "wait")

            if status == "wait":
                await asyncio.sleep(2)
            elif status == "scaned":
                emit({"type": "status", "value": "scaned"})
                await asyncio.sleep(1)
            elif status == "scaned_but_redirect":
                redirect_host = str(status_resp.get("redirect_host") or "")
                if redirect_host:
                    current_base = f"https://{redirect_host}"
                await asyncio.sleep(1)
            elif status == "expired":
                refresh_count += 1
                if refresh_count > 3:
                    emit({"type": "error", "msg": "二维码多次过期，请重新配置"})
                    return
                emit({"type": "log", "msg": f"二维码已过期，正在刷新… ({refresh_count}/3)"})
                try:
                    qr_resp = await _api_get(
                        session,
                        base_url=ILINK_BASE_URL,
                        endpoint=f"{EP_GET_BOT_QR}?bot_type=3",
                        timeout_ms=QR_TIMEOUT_MS,
                    )
                    qrcode_value = str(qr_resp.get("qrcode") or "")
                    qrcode_url   = str(qr_resp.get("qrcode_img_content") or "")
                    qr_scan_data = qrcode_url if qrcode_url else qrcode_value
                    emit({"type": "qr", "url": qr_scan_data})
                except Exception as e:
                    emit({"type": "error", "msg": f"二维码刷新失败: {e}"})
                    return
            elif status == "confirmed":
                account_id = str(status_resp.get("ilink_bot_id") or "")
                token      = str(status_resp.get("bot_token") or "")
                base_url   = str(status_resp.get("baseurl") or ILINK_BASE_URL)
                user_id    = str(status_resp.get("ilink_user_id") or "")
                if not account_id or not token:
                    emit({"type": "error", "msg": "登录成功但凭证数据不完整"})
                    return
                save_weixin_account(
                    hermes_home,
                    account_id=account_id,
                    token=token,
                    base_url=base_url,
                    user_id=user_id,
                )
                emit({"type": "done", "account_id": account_id})
                return
            else:
                await asyncio.sleep(1)

        emit({"type": "error", "msg": "微信登录超时（8分钟）"})

asyncio.run(main())
"#;

/// Run the WeChat QR login flow directly via the iLink Python API.
/// Streams JSON-line events; no CLI TUI interaction needed.
#[tauri::command]
pub async fn setup_wechat_gateway(window: tauri::Window) -> Result<(), String> {
    let Some(agent_dir) = hermes_agent_dir() else {
        let msg = "找不到 ~/.hermes/hermes-agent 目录".to_string();
        window.emit("wechat_setup_error", &msg).ok();
        return Err(msg);
    };

    // Write the helper script to a temp file.
    let script_path = std::env::temp_dir().join("hermes_weixin_login.py");
    tokio::fs::write(&script_path, WEIXIN_LOGIN_SCRIPT)
        .await
        .map_err(|e| format!("Failed to write login script: {e}"))?;

    let venv_python = agent_dir.join("venv").join("bin").join("python");
    let mut child = Command::new(&venv_python)
        .arg(&script_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start weixin login: {e}"))?;

    // Forward stderr as log lines (Python tracebacks etc.)
    if let Some(stderr) = child.stderr.take() {
        let win2 = window.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let line = line.trim().to_string();
                if !line.is_empty() {
                    win2.emit("wechat_setup_progress", WeChatSetupProgress {
                        line,
                        phase: "setup_running".to_string(),
                        qr_url: None,
                    }).ok();
                }
            }
        });
    }

    if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout).lines();
        loop {
            match reader.next_line().await {
                Ok(Some(raw)) => {
                    let raw = raw.trim().to_string();
                    if raw.is_empty() { continue; }

                    // Try to parse as JSON event from our script.
                    if let Ok(ev) = serde_json::from_str::<QrEvent>(&raw) {
                        match ev.kind.as_str() {
                            "qr" => {
                                let url = ev.url.unwrap_or_default();
                                window.emit("wechat_setup_progress", WeChatSetupProgress {
                                    line: "扫描下方二维码登录微信".to_string(),
                                    phase: "qr_shown".to_string(),
                                    qr_url: Some(url),
                                }).ok();
                            }
                            "status" => {
                                let value = ev.value.unwrap_or_default();
                                if value == "scaned" {
                                    window.emit("wechat_setup_progress", WeChatSetupProgress {
                                        line: "已扫码，请在微信里确认…".to_string(),
                                        phase: "scan_waiting".to_string(),
                                        qr_url: None,
                                    }).ok();
                                }
                            }
                            "log" => {
                                if let Some(msg) = ev.msg {
                                    window.emit("wechat_setup_progress", WeChatSetupProgress {
                                        line: msg,
                                        phase: "setup_running".to_string(),
                                        qr_url: None,
                                    }).ok();
                                }
                            }
                            "done" => {
                                window.emit("wechat_setup_done", ()).ok();
                            }
                            "error" => {
                                let msg = ev.msg.unwrap_or_else(|| "未知错误".to_string());
                                window.emit("wechat_setup_error", &msg).ok();
                            }
                            _ => {}
                        }
                    } else {
                        // Non-JSON line — show as log
                        window.emit("wechat_setup_progress", WeChatSetupProgress {
                            line: raw,
                            phase: "setup_running".to_string(),
                            qr_url: None,
                        }).ok();
                    }
                }
                Ok(None) => break,
                Err(e) => {
                    let msg = e.to_string();
                    window.emit("wechat_setup_error", &msg).ok();
                    return Err(msg);
                }
            }
        }
    }

    let _ = child.wait().await;
    Ok(())
}
