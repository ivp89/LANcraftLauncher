use futures_util::StreamExt;
use serde::Serialize;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgress {
    pub game_id: String,
    pub downloaded: u64,
    pub total: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct ExtractProgress {
    pub game_id: String,
    pub extracted: usize,
    pub total: usize,
}

#[tauri::command]
pub async fn download_and_install_game(
    app: AppHandle,
    game_id: String,
    server_url: String,
    token: String,
    install_dir: String,
) -> Result<String, String> {
    let url = format!("{}/api/Games/{}/Download", server_url.trim_end_matches('/'), game_id);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("X-API-Version", "1.0.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Server returned {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);

    // Download to temp file
    let temp_path = PathBuf::from(&install_dir).join(format!("{}.zip.tmp", game_id));
    std::fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;

    let mut file = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                game_id: game_id.clone(),
                downloaded,
                total,
            },
        );
    }
    drop(file);

    // Extract ZIP to game directory
    let game_dir = PathBuf::from(&install_dir).join(&game_id);
    std::fs::create_dir_all(&game_dir).map_err(|e| e.to_string())?;

    let zip_file = std::fs::File::open(&temp_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| e.to_string())?;
    let total = archive.len();

    for i in 0..total {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let out_path = game_dir.join(entry.mangled_name());

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out_file = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
        }

        let _ = app.emit(
            "extract-progress",
            ExtractProgress {
                game_id: game_id.clone(),
                extracted: i + 1,
                total,
            },
        );
    }

    std::fs::remove_file(&temp_path).ok();

    Ok(game_dir.to_string_lossy().to_string())
}
