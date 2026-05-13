use serde::Deserialize;
use std::io::Write;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Script {
    pub id: String,
    #[serde(rename = "type")]
    pub script_type: i32,
    pub contents: String,
    pub requires_admin: bool,
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
    debug: bool,
) -> Result<(), String> {
    for script in scripts.iter().filter(|s| s.script_type == script_type) {
        run_script(script, install_path, server_url, debug).await?;
    }
    Ok(())
}

async fn run_script(
    script: &Script,
    install_path: &str,
    server_url: &str,
    debug: bool,
) -> Result<(), String> {
    let temp_path = std::env::temp_dir().join(format!("lancraft_{}.ps1", script.id));

    let preamble = format!(
        "$InstallDirectory = '{}'\n$ServerAddress = '{}'\n",
        install_path.replace('\'', "''"),
        server_url.replace('\'', "''"),
    );

    {
        let mut f = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
        f.write_all(preamble.as_bytes()).map_err(|e| e.to_string())?;
        f.write_all(script.contents.as_bytes()).map_err(|e| e.to_string())?;
    }

    let result = spawn_script(&temp_path, install_path, script.requires_admin, debug).await;

    std::fs::remove_file(&temp_path).ok();

    let status = result.map_err(|e| format!("Не удалось запустить pwsh: {}", e))?;

    if !status.success() {
        return Err(format!("Скрипт завершился с кодом {:?}", status.code()));
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
        eprintln!(
            "[script debug] stdout:\n{}",
            String::from_utf8_lossy(&output.stdout)
        );
        eprintln!(
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
    debug: bool,
) -> Result<(), String> {
    let scripts = fetch_scripts(&game_id, &server_url, &token).await;
    run_scripts_of_type(&scripts, script_type, &install_path, &server_url, debug).await
}
