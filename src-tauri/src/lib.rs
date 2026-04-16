mod commands;

use commands::{config, gateway, installer, process, tools};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示 Hermes Manager", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            installer::detect_platform,
            installer::check_hermes_version,
            installer::install_hermes,
            installer::uninstall_hermes,
            config::get_config,
            config::save_config,
            config::save_api_key,
            config::test_api_connection,
            config::get_system_locale,
            process::run_doctor,
            process::get_recent_activity,
            tools::get_tools,
            tools::save_tools,
            gateway::get_gateway_config,
            gateway::save_gateway_config,
            gateway::get_gateway_status,
            gateway::start_gateway,
            gateway::stop_gateway,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
