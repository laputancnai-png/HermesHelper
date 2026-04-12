mod commands;

use commands::{config, installer, process};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            installer::detect_platform,
            installer::check_hermes_version,
            installer::install_hermes,
            installer::uninstall_hermes,
            config::get_config,
            config::save_config,
            config::save_api_key,
            config::test_api_connection,
            process::run_doctor,
            process::get_recent_activity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
