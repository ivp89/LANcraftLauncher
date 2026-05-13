import { refreshToken } from "./auth";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

const API_VERSION = "1.0.0";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const { token, serverUrl } = getStoreState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Version": API_VERSION,
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${serverUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && !isRetry) {
    const auth = useAuthStore.getState();
    if (auth.refreshToken && auth.expiration) {
      try {
        const newToken = await refreshToken(serverUrl, {
          accessToken: auth.token ?? "",
          refreshToken: auth.refreshToken,
          expiration: auth.expiration,
        });
        await auth.setAuth(newToken);
        return apiFetch<T>(path, options, true);
      } catch {
        await auth.clearAuth();
      }
    } else {
      await auth.clearAuth();
    }
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      message = err.message ?? err.error ?? message;
    } catch {}
    throw new ApiError(response.status, message);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return response.json();
}

function getStoreState() {
  const auth = useAuthStore.getState();
  const settings = useSettingsStore.getState();
  return {
    token: auth.token,
    serverUrl: settings.serverUrl,
  };
}

export function mediaUrl(mediaId: string, fileId: string, serverUrl?: string): string {
  const url = serverUrl ?? useSettingsStore.getState().serverUrl;
  return `${url.replace(/\/$/, "")}/api/Media/${mediaId}/Download?fileId=${fileId}`;
}

export function thumbnailUrl(mediaId: string, serverUrl?: string): string {
  const url = serverUrl ?? useSettingsStore.getState().serverUrl;
  return `${url.replace(/\/$/, "")}/api/Media/${mediaId}/Thumbnail`;
}
