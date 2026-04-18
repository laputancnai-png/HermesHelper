#[tauri::command]
pub async fn check_dashboard_ready() -> bool {
    tokio::net::TcpStream::connect("127.0.0.1:9119").await.is_ok()
}
