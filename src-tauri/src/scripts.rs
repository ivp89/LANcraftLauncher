use log::{debug, error, info};
use serde::Deserialize;
use std::io::Write;
use std::path::PathBuf;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Script {
    pub id: String,
    #[serde(rename = "type")]
    pub script_type: i32,
    pub contents: String,
    pub requires_admin: bool,
}

fn script_type_name(t: i32) -> &'static str {
    match t {
        0 => "Install",
        1 => "Uninstall",
        2 => "NameChange",
        3 => "KeyChange",
        4 => "SaveUpload",
        5 => "SaveDownload",
        6 => "Detect",
        7 => "BeforeStart",
        8 => "AfterStop",
        _ => "Unknown",
    }
}

fn script_file_name(t: i32) -> &'static str {
    match t {
        0 => "Install.ps1",
        1 => "Uninstall.ps1",
        2 => "ChangeName.ps1",
        3 => "ChangeKey.ps1",
        4 => "SaveUpload.ps1",
        5 => "SaveDownload.ps1",
        7 => "BeforeStart.ps1",
        8 => "AfterStop.ps1",
        _ => "",
    }
}

fn metadata_dir(install_path: &str, game_id: &str) -> PathBuf {
    PathBuf::from(install_path).join(".lancommander").join(game_id)
}

pub fn read_player_alias(install_path: &str, game_id: &str) -> String {
    let path = metadata_dir(install_path, game_id).join("PlayerAlias");
    std::fs::read_to_string(&path)
        .unwrap_or_default()
        .trim()
        .to_string()
}

pub fn write_player_alias(install_path: &str, game_id: &str, alias: &str) {
    let dir = metadata_dir(install_path, game_id);
    let _ = std::fs::create_dir_all(&dir);
    let _ = std::fs::write(dir.join("PlayerAlias"), alias);
}

pub fn save_scripts_to_disk(scripts: &[Script], install_path: &str, game_id: &str) {
    let dir = metadata_dir(install_path, game_id);
    if let Err(e) = std::fs::create_dir_all(&dir) {
        error!("save_scripts_to_disk: failed to create dir {}: {}", dir.display(), e);
        return;
    }
    for script in scripts {
        let filename = script_file_name(script.script_type);
        if !filename.is_empty() {
            match std::fs::write(dir.join(filename), &script.contents) {
                Ok(_) => info!("  saved script {} to {}", filename, dir.display()),
                Err(e) => error!("  failed to save {}: {}", filename, e),
            }
        }
    }
}

pub fn load_script_from_disk(install_path: &str, game_id: &str, script_type: i32) -> Option<Script> {
    let filename = script_file_name(script_type);
    if filename.is_empty() {
        return None;
    }
    let path = metadata_dir(install_path, game_id).join(filename);
    let contents = std::fs::read_to_string(&path).ok()?;
    if contents.is_empty() {
        return None;
    }
    Some(Script {
        id: format!("disk:{}", filename),
        script_type,
        contents,
        requires_admin: false,
    })
}

pub async fn fetch_scripts(game_id: &str, server_url: &str, token: &str) -> Vec<Script> {
    let url = format!(
        "{}/api/Games/{}/Scripts",
        server_url.trim_end_matches('/'),
        game_id
    );
    let client = reqwest::Client::new();
    match client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("X-API-Version", "1.0.0")
        .send()
        .await
    {
        Ok(r) => r.json::<Vec<Script>>().await.unwrap_or_default(),
        Err(_) => vec![],
    }
}

pub async fn run_scripts_of_type(
    scripts: &[Script],
    script_type: i32,
    install_path: &str,
    server_url: &str,
    old_alias: &str,
    new_alias: &str,
    debug: bool,
) -> Result<(), String> {
    let matching: Vec<_> = scripts.iter().filter(|s| s.script_type == script_type).collect();
    info!(
        "run_scripts_of_type: type={} ({}) — {} script(s) to run",
        script_type,
        script_type_name(script_type),
        matching.len()
    );
    for script in matching {
        info!("  running script id={} requires_admin={}", script.id, script.requires_admin);
        run_script(script, install_path, server_url, old_alias, new_alias, debug).await?;
        info!("  script id={} completed successfully", script.id);
    }
    Ok(())
}

async fn run_script(
    script: &Script,
    install_path: &str,
    server_url: &str,
    old_alias: &str,
    new_alias: &str,
    debug: bool,
) -> Result<(), String> {
    let temp_path = std::env::temp_dir().join(format!("lancraft_{}.ps1", script.id));

    let preamble = format!(
        "$InstallDirectory = '{}'\n$DefaultInstallDirectory = '{}'\n$ServerAddress = '{}'\n$ScriptType = {}\n$PlayerAlias = '{}'\n$OldPlayerAlias = '{}'\n$NewPlayerAlias = '{}'\n",
        install_path.replace('\'', "''"),
        install_path.replace('\'', "''"),
        server_url.replace('\'', "''"),
        script.script_type,
        old_alias.replace('\'', "''"),
        old_alias.replace('\'', "''"),
        new_alias.replace('\'', "''"),
    );

    {
        let mut f = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
        f.write_all(preamble.as_bytes()).map_err(|e| e.to_string())?;
        f.write_all(script.contents.as_bytes()).map_err(|e| e.to_string())?;
    }

    let result = spawn_script(&temp_path, install_path, script.requires_admin, debug).await;

    std::fs::remove_file(&temp_path).ok();

    let status = result.map_err(|e| {
        let msg = format!("Не удалось запустить pwsh: {}", e);
        error!("  script id={} failed to spawn: {}", script.id, e);
        msg
    })?;

    if !status.success() {
        let msg = format!("Скрипт завершился с кодом {:?}", status.code());
        error!("  script id={} {}", script.id, msg);
        return Err(msg);
    }

    Ok(())
}

#[cfg(target_os = "windows")]
async fn spawn_script(
    script_path: &std::path::Path,
    working_dir: &str,
    requires_admin: bool,
    debug: bool,
) -> std::io::Result<std::process::ExitStatus> {
    use std::os::windows::process::CommandExt;
    // CREATE_NEW_CONSOLE — видимое окно консоли в режиме отладки
    const CREATE_NEW_CONSOLE: u32 = 0x00000010;

    if requires_admin {
        let arg = if debug {
            format!(
                "Start-Process powershell -ArgumentList '-NoProfile -File \"{}\"' -Verb RunAs -Wait",
                script_path.to_string_lossy().replace('"', "\\\"")
            )
        } else {
            format!(
                "Start-Process powershell -ArgumentList '-NonInteractive -NoProfile -File \"{}\"' -Verb RunAs -Wait",
                script_path.to_string_lossy().replace('"', "\\\"")
            )
        };
        let mut cmd = tokio::process::Command::new("powershell");
        cmd.args(["-NonInteractive", "-NoProfile", "-Command", &arg])
            .current_dir(working_dir);
        if debug {
            cmd.creation_flags(CREATE_NEW_CONSOLE);
        }
        cmd.status().await
    } else if debug {
        tokio::process::Command::new("powershell")
            .args(["-NoProfile", "-File"])
            .arg(script_path)
            .current_dir(working_dir)
            .creation_flags(CREATE_NEW_CONSOLE)
            .status()
            .await
    } else {
        tokio::process::Command::new("powershell")
            .args(["-NonInteractive", "-NoProfile", "-File"])
            .arg(script_path)
            .current_dir(working_dir)
            .status()
            .await
    }
}

#[cfg(not(target_os = "windows"))]
async fn spawn_script(
    script_path: &std::path::Path,
    working_dir: &str,
    _requires_admin: bool,
    debug: bool,
) -> std::io::Result<std::process::ExitStatus> {
    if debug {
        let output = tokio::process::Command::new("pwsh")
            .args(["-NoProfile", "-File"])
            .arg(script_path)
            .current_dir(working_dir)
            .output()
            .await?;
        debug!(
            "[script debug] stdout:\n{}",
            String::from_utf8_lossy(&output.stdout)
        );
        debug!(
            "[script debug] stderr:\n{}",
            String::from_utf8_lossy(&output.stderr)
        );
        Ok(output.status)
    } else {
        tokio::process::Command::new("pwsh")
            .args(["-NonInteractive", "-NoProfile", "-File"])
            .arg(script_path)
            .current_dir(working_dir)
            .status()
            .await
    }
}

#[tauri::command]
pub async fn run_game_scripts(
    game_id: String,
    script_type: i32,
    server_url: String,
    token: String,
    install_path: String,
    new_player_alias: Option<String>,
    debug: bool,
) -> Result<(), String> {
    info!(
        "run_game_scripts: game_id={game_id} type={script_type} ({})",
        script_type_name(script_type)
    );

    // Try disk first; fall back to server fetch
    let scripts = match load_script_from_disk(&install_path, &game_id, script_type) {
        Some(s) => {
            info!("  loaded script from disk for type={script_type}");
            vec![s]
        }
        None => {
            info!("  no disk script found, fetching from server");
            let all = fetch_scripts(&game_id, &server_url, &token).await;
            info!("  fetched {} scripts", all.len());
            all
        }
    };

    let old_alias = read_player_alias(&install_path, &game_id);
    let new_alias = new_player_alias.as_deref().unwrap_or(&old_alias);

    run_scripts_of_type(&scripts, script_type, &install_path, &server_url, &old_alias, new_alias, debug).await?;

    // Persist updated alias after a successful NameChange
    if script_type == 2 && !new_alias.is_empty() {
        write_player_alias(&install_path, &game_id, new_alias);
        info!("  PlayerAlias updated to '{new_alias}'");
    }

    Ok(())
}
