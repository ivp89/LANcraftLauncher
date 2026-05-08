use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::scripts;

#[derive(Debug, Deserialize, Serialize)]
pub struct GameAction {
    pub executable: String,
    pub arguments: Option<String>,
    pub working_dir: Option<String>,
}

#[tauri::command]
pub async fn launch_game(
    game_id: String,
    action: GameAction,
    install_path: String,
    server_url: String,
    token: String,
) -> Result<(), String> {
    let exe_path = PathBuf::from(&install_path).join(&action.executable);

    if !exe_path.exists() {
        return Err(format!("Executable not found: {}", exe_path.display()));
    }

    let working_dir = action
        .working_dir
        .as_deref()
        .map(|d| PathBuf::from(&install_path).join(d))
        .unwrap_or_else(|| PathBuf::from(&install_path));

    let mut cmd = tokio::process::Command::new(&exe_path);
    cmd.current_dir(&working_dir);

    if let Some(args) = &action.arguments {
        for arg in args.split_whitespace() {
            cmd.arg(arg);
        }
    }

    let all_scripts = scripts::fetch_scripts(&game_id, &server_url, &token).await;

    // BeforeStart — блокирует запуск если падает
    scripts::run_scripts_of_type(&all_scripts, 7, &install_path, &server_url).await?;

    notify_server(&server_url, &token, &game_id, "Start").await;

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    let server_url = server_url.clone();
    let token = token.clone();
    let game_id = game_id.clone();
    let install_path = install_path.clone();
    tokio::spawn(async move {
        let _ = child.wait().await;
        // AfterStop — ошибки не критичны
        let _ = scripts::run_scripts_of_type(&all_scripts, 8, &install_path, &server_url).await;
        notify_server(&server_url, &token, &game_id, "End").await;
    });

    Ok(())
}

async fn notify_server(server_url: &str, token: &str, game_id: &str, event: &str) {
    let url = format!(
        "{}/api/PlaySessions/{}/{}",
        server_url.trim_end_matches('/'),
        event,
        game_id,
    );
    let client = reqwest::Client::new();
    let _ = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("X-API-Version", "1.0.0")
        .send()
        .await;
}
