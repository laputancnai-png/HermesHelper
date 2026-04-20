use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State, WebviewBuilder, WebviewUrl};
use tokio::process::Command;

pub struct DashboardWebview(pub Mutex<Option<tauri::Webview<tauri::Wry>>>);

// Mutex to prevent concurrent build attempts
static BUILD_LOCK: std::sync::OnceLock<tokio::sync::Mutex<()>> = std::sync::OnceLock::new();

fn build_lock() -> &'static tokio::sync::Mutex<()> {
    BUILD_LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

const DASHBOARD_PORT: u16 = 9119;

/// Get the path to the Hermes agent web directory
fn hermes_agent_web_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let web_dir = home.join(".hermes/hermes-agent/web");
    if web_dir.exists() {
        Some(web_dir)
    } else {
        None
    }
}

/// Ensure the web frontend is built; returns true if ready, false if build failed
async fn ensure_web_frontend_built() -> bool {
    let web_dir = match hermes_agent_web_dir() {
        Some(d) => d,
        None => return false, // no web directory
    };

    let web_dist = web_dir.join("../hermes_cli/web_dist");
    let index_html = web_dist.join("index.html");

    // If web_dist/index.html exists, we're good
    if index_html.exists() {
        return true;
    }

    // Check if package.json exists
    let package_json = web_dir.join("package.json");
    if !package_json.exists() {
        return false; // no package.json, can't build
    }

    // Acquire lock to prevent concurrent builds
    let _lock = build_lock().lock().await;

    // Double-check after acquiring lock (in case another task just built it)
    if index_html.exists() {
        return true;
    }

    eprintln!("[Dashboard] Building web frontend...");

    // Run: npm install
    match Command::new("npm")
        .arg("install")
        .current_dir(&web_dir)
        .output()
        .await
    {
        Ok(output) => {
            if !output.status.success() {
                eprintln!("[Dashboard] npm install failed: {}", String::from_utf8_lossy(&output.stderr));
                return false;
            }
        }
        Err(e) => {
            eprintln!("[Dashboard] Failed to run npm install: {}", e);
            return false;
        }
    }

    // Run: npm run build
    match Command::new("npm")
        .arg("run")
        .arg("build")
        .current_dir(&web_dir)
        .output()
        .await
    {
        Ok(output) => {
            if !output.status.success() {
                eprintln!("[Dashboard] npm run build failed: {}", String::from_utf8_lossy(&output.stderr));
                return false;
            }
            eprintln!("[Dashboard] Web frontend built successfully");
            // Check if index.html was created
            index_html.exists()
        }
        Err(e) => {
            eprintln!("[Dashboard] Failed to run npm run build: {}", e);
            false
        }
    }
}

#[tauri::command]
pub async fn check_dashboard_ready() -> bool {
    // First, ensure web frontend is built
    if !ensure_web_frontend_built().await {
        return false;
    }

    // Then check if the dashboard port is responsive
    tokio::net::TcpStream::connect(("127.0.0.1", DASHBOARD_PORT))
        .await
        .is_ok()
}

#[tauri::command]
pub async fn show_dashboard(
    app: AppHandle,
    state: State<'_, DashboardWebview>,
    lang: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(wv) = guard.as_ref() {
        wv.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
        wv.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
        wv.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let main_win = app.get_window("main").ok_or("no main window")?;
    let locale = if lang == "zh" { "zh" } else { "en" };
    // Set locale before React boots; also hide Hermes' own header so only content shows.
    let init_script = format!(
        "localStorage.setItem('hermes-locale','{}');\
         document.addEventListener('DOMContentLoaded',function(){{\
           var s=document.createElement('style');\
           s.textContent='header{{display:none!important}}';\
           document.head.appendChild(s);\
         }});",
        locale
    );

    let url: tauri::Url = format!("http://127.0.0.1:{}/", DASHBOARD_PORT)
        .parse::<tauri::Url>()
        .map_err(|e| e.to_string())?;

    let webview = main_win
        .add_child(
            WebviewBuilder::new("hermes-dashboard", WebviewUrl::External(url))
                .initialization_script(&init_script),
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| e.to_string())?;

    *guard = Some(webview);
    Ok(())
}

#[tauri::command]
pub async fn hide_dashboard(state: State<'_, DashboardWebview>) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(wv) = guard.as_ref() {
        wv.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn set_dashboard_language(
    state: State<'_, DashboardWebview>,
    lang: String,
) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(wv) = guard.as_ref() {
        let locale = if lang == "zh" { "zh" } else { "en" };
        let script = format!(
            "localStorage.setItem('hermes-locale','{}');window.location.reload();",
            locale
        );
        wv.eval(script).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn resize_dashboard(
    state: State<'_, DashboardWebview>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(wv) = guard.as_ref() {
        wv.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
        wv.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    }
    Ok(())
}
