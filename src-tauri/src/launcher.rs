use log::{error, info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

pub struct RunningGames(pub Arc<Mutex<HashMap<String, u32>>>);

impl RunningGames {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(HashMap::new())))
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GameAction {
    pub executable: String,
    pub arguments: Option<String>,
    pub working_dir: Option<String>,
    pub variables: Option<HashMap<String, String>>,
}

/// Replaces {InstallDir}/{InstallDirectory}/{VarName}, %ENV_VAR%, and slashes → OS separator.
/// skip_slashes=true keeps forward slashes (for arguments).
fn expand_variables(
    s: &str,
    install_path: &str,
    variables: &HashMap<String, String>,
    skip_slashes: bool,
) -> String {
    let mut result = s.to_string();

    // {InstallDir} and {InstallDirectory} — both forms used in the wild
    result = result.replace("{InstallDir}", install_path);
    result = result.replace("{InstallDirectory}", install_path);

    // built-in + custom variables: {Key}
    for (k, v) in variables {
        result = result.replace(&format!("{{{}}}", k), v);
    }

    // %ENV_VAR% — expand OS environment variables
    let mut expanded = String::with_capacity(result.len());
    let mut chars = result.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let mut name = String::new();
            let mut closed = false;
            for inner in chars.by_ref() {
                if inner == '%' {
                    closed = true;
                    break;
                }
                name.push(inner);
            }
            if closed && !name.is_empty() {
                if let Ok(val) = std::env::var(&name) {
                    expanded.push_str(&val);
                } else {
                    expanded.push('%');
                    expanded.push_str(&name);
                    expanded.push('%');
                }
            } else {
                expanded.push('%');
                expanded.push_str(&name);
            }
        } else {
            expanded.push(c);
        }
    }
    result = expanded;

    // Normalize both slash types to OS separator (skip for arguments)
    if !skip_slashes {
        result = result.replace('\\', std::path::MAIN_SEPARATOR_STR);
        result = result.replace('/', std::path::MAIN_SEPARATOR_STR);
    }

    result.trim_end_matches(std::path::MAIN_SEPARATOR).to_string()
}

/// Resolves a path: after variable expansion, if not absolute — joins with install_path.
fn resolve_path(raw: &str, install_path: &str, variables: &HashMap<String, String>) -> PathBuf {
    let expanded = expand_variables(raw, install_path, variables, false);
    let p = PathBuf::from(&expanded);
    if p.is_absolute() {
        p
    } else {
        PathBuf::from(install_path).join(p)
    }
}

#[derive(Deserialize)]
struct ProfileResponse {
    alias: Option<String>,
    #[serde(rename = "userName")]
    user_name: Option<String>,
}


#[tauri::command]
pub async fn launch_game(
    app: tauri::AppHandle,
    game_id: String,
    action: GameAction,
    install_path: String,
    server_url: String,
    token: String,
    running_games: tauri::State<'_, RunningGames>,
) -> Result<(), String> {
    // Fetch alias from server (best-effort)
    let player_alias = {
        let url = format!("{}/api/Profile", server_url.trim_end_matches('/'));
        let client = reqwest::Client::new();
        let result = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("X-API-Version", "1.0.0")
            .send()
            .await;
        match result {
            Ok(r) => r.json::<ProfileResponse>().await
                .ok()
                .and_then(|p| p.alias.or(p.user_name))
                .unwrap_or_default(),
            Err(_) => String::new(),
        }
    };

    // Collect display info from primary monitor (best-effort)
    let (display_width, display_height, display_refresh_rate) =
        display_info::DisplayInfo::all()
            .unwrap_or_default()
            .into_iter()
            .find(|d| d.is_primary)
            .map(|d| (d.width.to_string(), d.height.to_string(), (d.frequency as u32).to_string()))
            .unwrap_or_else(|| ("0".to_string(), "0".to_string(), "60".to_string()));

    // Built-in variables (action.variables take precedence)
    let mut variables: HashMap<String, String> = [
        ("PlayerAlias".to_string(), player_alias.clone()),
        ("ServerAddress".to_string(), server_url.clone()),
        ("DisplayWidth".to_string(), display_width),
        ("DisplayHeight".to_string(), display_height),
        ("DisplayRefreshRate".to_string(), display_refresh_rate),
        ("DisplayBitDepth".to_string(), "32".to_string()),
    ]
    .into_iter()
    .collect();
    variables.extend(action.variables.clone().unwrap_or_default());

    info!("launch_game: game_id={game_id}");
    info!("  install_path = {install_path}");
    info!("  raw executable = {}", action.executable);
    info!("  raw working_dir = {:?}", action.working_dir);
    info!("  raw arguments = {:?}", action.arguments);
    info!("  variables = {:?}", variables);

    let exe_path = resolve_path(&action.executable, &install_path, &variables);
    info!("  resolved exe_path = {}", exe_path.display());

    if !exe_path.exists() {
        let msg = format!("Executable not found: {}", exe_path.display());
        error!("{msg}");
        return Err(msg);
    }

    let working_dir = action
        .working_dir
        .as_deref()
        .map(|d| {
            let p = resolve_path(d, &install_path, &variables);
            info!("  resolved working_dir = {}", p.display());
            p
        })
        .unwrap_or_else(|| {
            info!("  working_dir not set, using install_path");
            PathBuf::from(&install_path)
        });

    let mut cmd = tokio::process::Command::new(&exe_path);
    cmd.current_dir(&working_dir);

    if let Some(args) = &action.arguments {
        let expanded_args = expand_variables(args, &install_path, &variables, true);
        info!("  expanded arguments = {expanded_args}");
        for arg in shell_split(&expanded_args) {
            cmd.arg(arg);
        }
    }

    notify_server(&server_url, &token, &game_id, "Start").await;

    let mut child = cmd.spawn().map_err(|e| {
        let msg = format!("Failed to spawn process: {e}");
        error!("{msg}");
        msg
    })?;
    info!("  process spawned successfully");

    // Track running process by PID so we can kill it on demand
    let pid = child.id().unwrap_or(0);
    if pid != 0 {
        running_games.0.lock().unwrap().insert(game_id.clone(), pid);
    }
    let games_arc = Arc::clone(&running_games.0);

    let server_url = server_url.clone();
    let token = token.clone();
    let game_id_clone = game_id.clone();
    tokio::spawn(async move {
        let status = child.wait().await;
        info!("game process exited: {:?}", status);
        games_arc.lock().unwrap().remove(&game_id_clone);
        let _ = app.emit("game-exited", &game_id_clone);
        notify_server(&server_url, &token, &game_id_clone, "End").await;
    });

    Ok(())
}

#[tauri::command]
pub fn stop_game(
    game_id: String,
    running_games: tauri::State<'_, RunningGames>,
) -> Result<(), String> {
    let pid = running_games.0.lock().unwrap().get(&game_id).copied();
    if let Some(pid) = pid {
        info!("stop_game: killing pid {pid} for game {game_id}");
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .spawn();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("kill")
                .args(["-TERM", &pid.to_string()])
                .spawn();
        }
    }
    Ok(())
}

/// Splits a command-line argument string respecting double-quoted segments.
fn shell_split(s: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;

    for c in s.chars() {
        match c {
            '"' => in_quotes = !in_quotes,
            ' ' if !in_quotes => {
                if !current.is_empty() {
                    args.push(current.clone());
                    current.clear();
                }
            }
            _ => current.push(c),
        }
    }
    if !current.is_empty() {
        args.push(current);
    }
    args
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
