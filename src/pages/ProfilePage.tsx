import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";

import { logout } from "../api/auth";
import { getProfile, changeAlias, fetchAvatarBlob } from "../api/profile";
import type { UserProfile } from "../api/profile";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, clearAuth } = useAuthStore();
  const { serverUrl } = useSettingsStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let blobUrl: string | null = null;

    async function load() {
      try {
        const [p, blob] = await Promise.all([getProfile(), fetchAvatarBlob()]);
        setProfile(p);
        setAlias(p.alias ?? "");
        blobUrl = blob;
        setAvatarUrl(blob);
      } catch {
        // profile failed to load — back to library
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  async function handleSaveAlias(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      await changeAlias(alias.trim());
      setProfile((p) => (p ? { ...p, alias: alias.trim() } : p));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (token) await logout(serverUrl, token);
    await clearAuth();
    queryClient.clear();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(222,47%,11%)]">
      <header
        className={clsx(
          "sticky top-0 z-10 px-6 py-3",
          "bg-[hsl(222,47%,11%)]/90 backdrop-blur",
          "border-b border-[hsl(216,34%,20%)]",
          "flex items-center gap-4",
        )}
      >
        <button onClick={() => navigate("/")} className="text-sm text-slate-400 hover:text-white">
          ← Библиотека
        </button>
        <h1 className="text-xl font-bold text-white">Профиль</h1>
        <div className="flex-1" />
        <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-slate-400 hover:text-white">
          Выйти
        </button>
      </header>

      <main className="flex flex-1 justify-center px-6 py-10">
        {loading ? (
          <p className="text-slate-400">Загрузка…</p>
        ) : !profile ? (
          <p className="text-red-400">Не удалось загрузить профиль</p>
        ) : (
          <div className="w-full max-w-md space-y-6">
            {/* Avatar + username */}
            <div className="flex items-center gap-5">
              <div
                className={clsx(
                  "h-20 w-20 overflow-hidden rounded-full",
                  "border border-[hsl(216,34%,30%)] bg-[hsl(216,34%,20%)]",
                  "flex items-center justify-center",
                )}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl text-slate-500">
                    {(profile.alias ?? profile.userName).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-white">{profile.alias ?? profile.userName}</p>
                {profile.alias && <p className="text-sm text-slate-500">@{profile.userName}</p>}
              </div>
            </div>

            {/* Change alias */}
            <div className="space-y-4 rounded-xl border border-[hsl(216,34%,25%)] bg-[hsl(222,47%,15%)] p-5">
              <h2 className="font-medium text-white">Псевдоним</h2>
              <form onSubmit={handleSaveAlias} className="space-y-3">
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={profile.userName}
                  maxLength={32}
                  className={clsx(
                    "w-full rounded-lg px-3 py-2",
                    "border border-[hsl(216,34%,30%)] bg-[hsl(216,34%,20%)]",
                    "text-white placeholder-slate-500",
                    "focus:border-blue-500 focus:outline-none",
                  )}
                />
                {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                {saveSuccess && <p className="text-sm text-green-400">Псевдоним сохранён</p>}
                <button
                  type="submit"
                  disabled={saving || alias.trim() === (profile.alias ?? "")}
                  className={clsx(
                    "w-full rounded-lg py-2 font-medium",
                    "bg-blue-600 text-white hover:bg-blue-500",
                    "transition-colors disabled:opacity-50",
                  )}
                >
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
