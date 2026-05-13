use tauri::Manager;

mod discovery;
mod install;
mod launcher;
mod saves;
mod scripts;
mod validate;

#[tauri::command]
fn open_dir(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Cannot determine home directory".to_string())
}

#[tauri::command]
fn get_log_path(app: tauri::AppHandle) -> Option<String> {
    app.path()
        .app_log_dir()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn get_default_install_dir() -> String {
    #[cfg(target_os = "windows")]
    if std::path::Path::new("C:\\").exists() {
        return "C:\\Games".to_string();
    }

    dirs::home_dir()
        .map(|p| p.join("Games").to_string_lossy().to_string())
        .unwrap_or_else(|| "Games".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(install::DownloadCancellations(Default::default()))
        .invoke_handler(tauri::generate_handler![
            discovery::discover_servers,
            install::download_and_install_game,
            install::cancel_download,
            launcher::launch_game,
            saves::download_save,
            saves::upload_save,
            validate::validate_files,
            scripts::run_game_scripts,
            open_dir,
            get_home_dir,
            get_default_install_dir,
            get_log_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
