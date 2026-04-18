const DASHBOARD_PORT: u16 = 9119;

#[tauri::command]
pub async fn check_dashboard_ready() -> bool {
    tokio::net::TcpStream::connect(("127.0.0.1", DASHBOARD_PORT))
        .await
        .is_ok()
}
