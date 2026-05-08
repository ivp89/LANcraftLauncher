use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveEntry {
    full_name: String,
    crc32: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileConflict {
    pub path: String,
    pub missing: bool,
}

#[tauri::command]
pub async fn validate_files(
    game_id: String,
    version: String,
    server_url: String,
    token: String,
    install_path: String,
) -> Result<Vec<FileConflict>, String> {
    let url = format!(
        "{}/api/Archives/Contents/{}/{}",
        server_url.trim_end_matches('/'),
        game_id,
        version
    );

    let client = reqwest::Client::new();
    let entries: Vec<ArchiveEntry> = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("X-API-Version", "1.0.0")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let install_dir = PathBuf::from(&install_path);
    let mut conflicts = Vec::new();

    for entry in entries {
        let local_path = install_dir.join(&entry.full_name);

        // Пропускаем директории и записи с U+FFFD — сервер не смог декодировать
        // оригинальное имя файла (не-UTF-8 кодировка в ZIP), сравнение ненадёжно.
        if local_path.is_dir() || entry.full_name.contains('\u{FFFD}') {
            continue;
        }

        if !local_path.exists() {
            conflicts.push(FileConflict {
                path: entry.full_name,
                missing: true,
            });
            continue;
        }

        let data = std::fs::read(&local_path).map_err(|e| e.to_string())?;
        let local_crc = crc32fast::hash(&data);

        if local_crc != entry.crc32 {
            conflicts.push(FileConflict {
                path: entry.full_name,
                missing: false,
            });
        }
    }

    Ok(conflicts)
}
