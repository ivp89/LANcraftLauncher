use log::{info, warn};
use std::path::{Path, PathBuf};
use tauri::Manager as _;

fn cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("media");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn ext_from_mime(mime: &str) -> String {
    match mime {
        "image/jpeg" | "image/jpg" => "jpg".to_string(),
        "image/png" => "png".to_string(),
        "image/webp" => "webp".to_string(),
        "image/gif" => "gif".to_string(),
        "image/bmp" => "bmp".to_string(),
        "image/svg+xml" => "svg".to_string(),
        _ => mime.split('/').last().unwrap_or("img").to_string(),
    }
}

/// Finds any cached file for this media id, regardless of its crc32 suffix.
/// Used as a stale-but-usable fallback when a fresh download fails (e.g. offline).
fn find_any_cached(dir: &Path, media_id: &str) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    let prefix = format!("{media_id}-");
    entries.flatten().find_map(|entry| {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&prefix) && !name.ends_with(".tmp") {
            Some(entry.path())
        } else {
            None
        }
    })
}

/// Removes cached files for this media id other than the one just written,
/// so a crc32 change (server-side media update) doesn't leave stale copies behind.
fn evict_stale(dir: &Path, media_id: &str, keep_filename: &str) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let prefix = format!("{media_id}-");
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&prefix) && name != keep_filename {
            std::fs::remove_file(entry.path()).ok();
        }
    }
}

async fn download_to(url: &str, path: &Path) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Server returned {}", response.status()));
    }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    let tmp_path = path.with_extension("tmp");
    std::fs::write(&tmp_path, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Returns a local file path for the given media item, downloading (and caching to
/// disk) it first if needed. The cache key embeds the media's crc32, so a changed
/// crc32 (server-side update) naturally misses the cache and triggers a re-download;
/// the stale copy is then evicted. If the download fails (e.g. offline) and a stale
/// cached copy exists, that stale copy is served instead of failing outright.
#[tauri::command]
pub async fn get_cached_media(
    app: tauri::AppHandle,
    media_id: String,
    crc32: String,
    mime_type: String,
    url: String,
) -> Result<String, String> {
    let dir = cache_dir(&app)?;
    let filename = format!("{media_id}-{crc32}.{}", ext_from_mime(&mime_type));
    let path = dir.join(&filename);

    if path.exists() {
        return Ok(path.to_string_lossy().to_string());
    }

    match download_to(&url, &path).await {
        Ok(()) => {
            info!("get_cached_media: cached {media_id} -> {}", path.display());
            evict_stale(&dir, &media_id, &filename);
            Ok(path.to_string_lossy().to_string())
        }
        Err(e) => match find_any_cached(&dir, &media_id) {
            Some(stale) => {
                warn!("get_cached_media: download failed for {media_id} ({e}), serving stale cache");
                Ok(stale.to_string_lossy().to_string())
            }
            None => Err(e),
        },
    }
}
