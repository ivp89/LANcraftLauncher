import { useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

import { mediaUrl, thumbnailUrl } from "@/api/client";
import type { Media } from "@/api/types";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Resolves a Media item to a local, disk-cached image URL. The Rust side keys the
 * cache by the media's crc32, so a server-side update naturally busts the cache; if
 * a fresh fetch fails (e.g. offline) a stale cached copy is served when available.
 * Falls back to the direct server URL if caching fails outright (e.g. never cached
 * and currently offline).
 */
function useCachedMedia(media: Media | null | undefined, kind: "thumbnail" | "download"): string | undefined {
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    setSrc(undefined);
    if (!media) return;

    let cancelled = false;
    const url = kind === "thumbnail" ? thumbnailUrl(media.id, serverUrl) : mediaUrl(media.id, media.fileId, serverUrl);

    invoke<string>("get_cached_media", {
      mediaId: media.id,
      crc32: media.crc32 ?? "",
      mimeType: media.mimeType ?? "",
      url,
    })
      .then((path) => {
        if (!cancelled) setSrc(convertFileSrc(path));
      })
      .catch(() => {
        if (!cancelled) setSrc(url);
      });

    return () => {
      cancelled = true;
    };
  }, [media?.id, media?.crc32, media?.mimeType, media?.fileId, kind, serverUrl]);

  return src;
}

export function useCachedThumbnail(media: Media | null | undefined): string | undefined {
  return useCachedMedia(media, "thumbnail");
}

export function useCachedMediaDownload(media: Media | null | undefined): string | undefined {
  return useCachedMedia(media, "download");
}
