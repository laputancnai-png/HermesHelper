mod commands;

use commands::{chat, config, dashboard, gateway, installer, migrate, ollama, process, status, tools, wechat};
use commands::dashboard::DashboardWebview;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                if let Err(err) = win.set_icon(tauri::include_image!("icons/32x32.png")) {
                    eprintln!("[hermes-manager] set window icon failed: {err}");
                }
                let _ = win.maximize();
            }

            let show = MenuItem::with_id(app, "show", "显示 Hermes Manager", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(tauri::include_image!("icons/tray-icon.png"))
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(win) = tray.app_handle().get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Start Hermes dashboard in background (no browser open).
            // Use the resolved binary path so this works in GUI context where
            // ~/.local/bin is not in PATH.
            let hermes_bin = commands::installer::hermes_binary_path()
                .unwrap_or_else(|| std::path::PathBuf::from("hermes"));
            if let Err(e) = std::process::Command::new(&hermes_bin)
                .args(["dashboard", "--no-open"])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
            {
                eprintln!("[hermes-manager] dashboard spawn failed ({}): {e}", hermes_bin.display());
            }

            Ok(())
        })
        .manage(DashboardWebview(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            chat::hermes_chat,
            dashboard::check_dashboard_ready,
            dashboard::show_dashboard,
            dashboard::hide_dashboard,
            dashboard::set_dashboard_language,
            dashboard::resize_dashboard,
            installer::detect_platform,
            installer::check_hermes_version,
            installer::install_hermes,
            installer::uninstall_hermes,
            config::get_config,
            config::save_config,
            config::save_api_key,
            config::get_api_key,
            config::remove_api_key,
            config::apply_provider_yaml_patch,
            config::test_api_connection,
            config::get_system_locale,
            ollama::check_ollama_installed,
            ollama::get_ollama_install_status,
            ollama::check_ollama_status,
            ollama::start_ollama_service,
            ollama::get_ollama_models,
            process::run_doctor,
            process::get_recent_activity,
            tools::get_tools,
            tools::save_tools,
            gateway::get_gateway_config,
            gateway::save_gateway_config,
            gateway::get_gateway_status,
            gateway::start_gateway,
            gateway::stop_gateway,
            gateway::verify_bot_token,
            gateway::approve_pairing,
            wechat::check_wechat_deps,
            wechat::install_wechat_deps,
            wechat::check_wechat_credentials,
            wechat::setup_wechat_gateway,
            migrate::export_data,
            migrate::preview_import,
            migrate::execute_import,
            status::get_hermes_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
