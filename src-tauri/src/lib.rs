mod commands;

use commands::{chat, config, dashboard, gateway, installer, migrate, process, status, tools};
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

            // Start Hermes dashboard in background (no browser open)
            if let Err(e) = std::process::Command::new("hermes")
                .args(["dashboard", "--no-open"])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
            {
                eprintln!("[hermes-manager] dashboard spawn failed: {e}");
            }

            Ok(())
        })
        .register_uri_scheme_protocol("hermes-ui", |_app, request| {
            use std::io::Read;

            let uri = request.uri();
            let path = uri.path();
            let query_raw = uri.query().unwrap_or("");

            // Extract __hm_lang and strip it before forwarding
            let lang = query_raw
                .split('&')
                .find(|s| s.starts_with("__hm_lang="))
                .and_then(|s| s.strip_prefix("__hm_lang="))
                .unwrap_or("en")
                .to_string();
            let forward_query: String = query_raw
                .split('&')
                .filter(|s| !s.starts_with("__hm_lang=") && !s.is_empty())
                .collect::<Vec<_>>()
                .join("&");
            let query_str = if forward_query.is_empty() {
                String::new()
            } else {
                format!("?{}", forward_query)
            };

            let url = format!("http://127.0.0.1:9119{}{}", path, query_str);

            let result = ureq::get(&url).call();
            match result {
                Ok(resp) => {
                    let status = resp.status();
                    let content_type = resp
                        .header("content-type")
                        .unwrap_or("application/octet-stream")
                        .to_string();

                    let body: Vec<u8> = if content_type.contains("text/html") {
                        let html = resp.into_string().unwrap_or_default();
                        let lang_script = format!(
                            r#"<script>(function(){{var l='{}';['lang','language','locale','i18n','preferred-language'].forEach(function(k){{try{{localStorage.setItem(k,l)}}catch(e){{}}}});document.documentElement.setAttribute('lang',l)}})();</script>"#,
                            lang
                        );
                        let css_inject = r#"<style id="hm-theme">:root{--primary:#5B5FEF!important;--color-primary:#5B5FEF!important;--accent:#5B5FEF!important;--brand:#5B5FEF!important}</style>"#;
                        html.replace("</head>", &format!("{}{}</head>", lang_script, css_inject))
                            .into_bytes()
                    } else {
                        let mut buf = vec![];
                        resp.into_reader().read_to_end(&mut buf).ok();
                        buf
                    };

                    tauri::http::Response::builder()
                        .status(status)
                        .header("content-type", &content_type)
                        .header("access-control-allow-origin", "*")
                        .body(body)
                        .unwrap()
                }
                Err(_) => tauri::http::Response::builder()
                    .status(502)
                    .header("content-type", "text/plain")
                    .body(b"Dashboard not available".to_vec())
                    .unwrap(),
            }
        })
        .invoke_handler(tauri::generate_handler![
            chat::hermes_chat,
            dashboard::check_dashboard_ready,
            installer::detect_platform,
            installer::check_hermes_version,
            installer::install_hermes,
            installer::uninstall_hermes,
            config::get_config,
            config::save_config,
            config::save_api_key,
            config::apply_provider_yaml_patch,
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
            migrate::export_data,
            migrate::preview_import,
            migrate::execute_import,
            status::get_hermes_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
