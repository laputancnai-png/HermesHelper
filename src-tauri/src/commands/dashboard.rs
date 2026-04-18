use std::sync::Mutex;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State, WebviewBuilder, WebviewUrl};

pub struct DashboardWebview(pub Mutex<Option<tauri::Webview<tauri::Wry>>>);

const DASHBOARD_PORT: u16 = 9119;

#[tauri::command]
pub async fn check_dashboard_ready() -> bool {
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
    let init_script = format!(
        "localStorage.setItem('hermes-locale','{}');",
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
