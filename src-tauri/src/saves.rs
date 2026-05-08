use reqwest::multipart;
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read, Write};
use std::path::PathBuf;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavePath {
    pub id: String,
    #[serde(rename = "type")]
    pub path_type: i32, // 0 = File, 1 = Registry
    pub path: String,
    pub working_directory: Option<String>,
    pub is_regex: bool,
}

fn resolve_save_dir(save_path: &SavePath, install_path: &str) -> PathBuf {
    let base = save_path
        .working_directory
        .as_deref()
        .filter(|d| !d.is_empty())
        .map(|d| PathBuf::from(d.replace("{InstallDir}", install_path)))
        .unwrap_or_else(|| PathBuf::from(install_path));

    base.join(save_path.path.replace("{InstallDir}", install_path))
}

fn collect_files(dir: &PathBuf) -> std::io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    if !dir.exists() {
        return Ok(files);
    }
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            files.extend(collect_files(&path)?);
        } else {
            files.push(path);
        }
    }
    Ok(files)
}

#[tauri::command]
pub async fn download_save(
    game_id: String,
    server_url: String,
    token: String,
    install_path: String,
    save_paths: Vec<SavePath>,
) -> Result<(), String> {
    let url = format!(
        "{}/api/Saves/Game/{}/Latest/Download",
        server_url.trim_end_matches('/'),
        game_id
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("X-API-Version", "1.0.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status() == 404 {
        return Ok(());
    }

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let cursor = Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();

        if name == "Manifest.yml" || name.ends_with('/') {
            continue;
        }

        let Some(rest) = name.strip_prefix("Files/") else {
            continue;
        };

        let Some((save_path_id, relative_path)) = rest.split_once('/') else {
            continue;
        };

        let Some(save_path) = save_paths.iter().find(|sp| sp.id == save_path_id) else {
            continue;
        };

        if save_path.path_type != 0 {
            continue;
        }

        let dest = resolve_save_dir(save_path, &install_path).join(relative_path);

        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut out = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn upload_save(
    game_id: String,
    server_url: String,
    token: String,
    install_path: String,
    save_paths: Vec<SavePath>,
) -> Result<(), String> {
    let options =
        SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let cursor = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);

    zip.start_file("Manifest.yml", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(format!("GameId: {}\n", game_id).as_bytes())
        .map_err(|e| e.to_string())?;

    for save_path in &save_paths {
        if save_path.path_type != 0 {
            continue;
        }

        let save_dir = resolve_save_dir(save_path, &install_path);
        let files = collect_files(&save_dir).map_err(|e| e.to_string())?;

        for file_path in files {
            let relative = file_path
                .strip_prefix(&save_dir)
                .map_err(|e| e.to_string())?;

            let zip_entry = format!(
                "Files/{}/{}",
                save_path.id,
                relative.to_string_lossy().replace('\\', "/")
            );

            zip.start_file(&zip_entry, options)
                .map_err(|e| e.to_string())?;

            let mut f = std::fs::File::open(&file_path).map_err(|e| e.to_string())?;
            let mut buf = Vec::new();
            f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            zip.write_all(&buf).map_err(|e| e.to_string())?;
        }
    }

    let zip_bytes = zip
        .finish()
        .map_err(|e| e.to_string())?
        .into_inner();

    let url = format!(
        "{}/api/Saves/Game/{}/Upload",
        server_url.trim_end_matches('/'),
        game_id
    );

    let part = multipart::Part::bytes(zip_bytes)
        .file_name("save.zip")
        .mime_str("application/zip")
        .map_err(|e| e.to_string())?;

    let form = multipart::Form::new().part("file", part);

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("X-API-Version", "1.0.0")
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Upload failed: HTTP {}", response.status()));
    }

    Ok(())
}
