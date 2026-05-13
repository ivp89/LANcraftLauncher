use futures_util::StreamExt;
use serde::Serialize;
use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgress {
    pub game_id: String,
    pub downloaded: u64,
    pub total: u64,
    pub speed: u64, // bytes per second
}

#[derive(Debug, Serialize, Clone)]
pub struct ExtractProgress {
    pub game_id: String,
    pub extracted: usize,
    pub total: usize,
}

pub struct DownloadCancellations(pub Mutex<HashMap<String, Arc<AtomicBool>>>);

fn sanitize_folder_name(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let s = s.trim();
    if s.is_empty() { "_".to_string() } else { s.to_string() }
}

#[tauri::command]
pub async fn download_and_install_game(
    app: AppHandle,
    cancellations: State<'_, DownloadCancellations>,
    game_id: String,
    game_title: String,
    server_url: String,
    token: String,
    install_dir: String,
) -> Result<String, String> {
    let cancelled = Arc::new(AtomicBool::new(false));
    cancellations
        .0
        .lock()
        .unwrap()
        .insert(game_id.clone(), cancelled.clone());

    let result = do_download(
        &app,
        &game_id,
        &game_title,
        &server_url,
        &token,
        &install_dir,
        cancelled,
    )
    .await;

    cancellations.0.lock().unwrap().remove(&game_id);
    result
}

async fn do_download(
    app: &AppHandle,
    game_id: &str,
    game_title: &str,
    server_url: &str,
    token: &str,
    install_dir: &str,
    cancelled: Arc<AtomicBool>,
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

    let temp_path = PathBuf::from(install_dir).join(format!("{}.zip.tmp", game_id));
    std::fs::create_dir_all(install_dir).map_err(|e| e.to_string())?;

    let mut file = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut speed_window_bytes: u64 = 0;
    let mut speed_window_start = std::time::Instant::now();
    let mut speed: u64 = 0;

    while let Some(chunk) = stream.next().await {
        if cancelled.load(Ordering::Relaxed) {
            drop(file);
            std::fs::remove_file(&temp_path).ok();
            return Err("cancelled".to_string());
        }
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        speed_window_bytes += chunk.len() as u64;

        let elapsed = speed_window_start.elapsed();
        if elapsed.as_millis() >= 500 {
            speed = (speed_window_bytes as f64 / elapsed.as_secs_f64()) as u64;
            speed_window_bytes = 0;
            speed_window_start = std::time::Instant::now();
        }

        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                game_id: game_id.to_string(),
                downloaded,
                total,
                speed,
            },
        );
    }
    drop(file);

    let folder_name = sanitize_folder_name(game_title);
    let game_dir = PathBuf::from(install_dir).join(&folder_name);
    std::fs::create_dir_all(&game_dir).map_err(|e| e.to_string())?;

    let zip_file = std::fs::File::open(&temp_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| e.to_string())?;
    let total = archive.len();

    for i in 0..total {
        if cancelled.load(Ordering::Relaxed) {
            std::fs::remove_file(&temp_path).ok();
            std::fs::remove_dir_all(&game_dir).ok();
            return Err("cancelled".to_string());
        }

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
                game_id: game_id.to_string(),
                extracted: i + 1,
                total,
            },
        );
    }

    std::fs::remove_file(&temp_path).ok();

    Ok(game_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn cancel_download(
    cancellations: State<'_, DownloadCancellations>,
    game_id: String,
) {
    if let Some(flag) = cancellations.0.lock().unwrap().get(&game_id) {
        flag.store(true, Ordering::Relaxed);
    }
}
