import { apiFetch } from "./client";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

export interface UserProfile {
  id: string;
  userName: string;
  alias: string | null;
}

export async function getProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/Profile");
}

export async function changeAlias(alias: string): Promise<void> {
  return apiFetch<void>("/api/Profile/ChangeAlias", {
    method: "PUT",
    body: JSON.stringify({ alias }),
  });
}

export function avatarUrl(): string {
  const serverUrl = useSettingsStore.getState().serverUrl;
  const token = useAuthStore.getState().token;
  return `${serverUrl.replace(/\/$/, "")}/api/Profile/Avatar?t=${token?.slice(-8) ?? ""}`;
}

export async function fetchAvatarBlob(): Promise<string | null> {
  const serverUrl = useSettingsStore.getState().serverUrl;
  const token = useAuthStore.getState().token;
  if (!token) return null;

  const res = await fetch(`${serverUrl.replace(/\/$/, "")}/api/Profile/Avatar`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-API-Version": "1.0.0",
    },
  });

  if (!res.ok) return null;

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
