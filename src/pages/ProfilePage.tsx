import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

import { logout } from "../api/auth";
import { getProfile, changeAlias, fetchAvatarBlob } from "../api/profile";
import type { UserProfile } from "../api/profile";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

const SCRIPT_TYPE_NAME_CHANGE = 2;

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

      const { installedGames, serverUrl: url, scriptDebugging } = useSettingsStore.getState();
      const { token: tok } = useAuthStore.getState();
      const entries = Object.entries(installedGames).filter(
        ([, g]) => g.installed,
      );
      if (entries.length > 0 && tok) {
        const results = await Promise.allSettled(
          entries.map(([gameId, g]) =>
            invoke("run_game_scripts", {
              gameId,
              scriptType: SCRIPT_TYPE_NAME_CHANGE,
              serverUrl: url,
              token: tok,
              installPath: g.installPath,
              debug: scriptDebugging,
            }),
          ),
        );
        const failed = results
          .map((r, i) =>
            r.status === "rejected"
              ? `${entries[i][0]}: ${r.reason}`
              : null,
          )
          .filter(Boolean);
        if (failed.length > 0) {
          setSaveError(`Псевдоним сохранён, но скрипты не выполнились:\n${failed.join("\n")}`);
          return;
        }
      }

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
    <div className="min-h-screen bg-[hsl(222,47%,11%)] flex flex-col">
      <header className="sticky top-0 z-10 bg-[hsl(222,47%,11%)]/90 backdrop-blur border-b border-[hsl(216,34%,20%)] px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="text-slate-400 hover:text-white text-sm"
        >
          ← Библиотека
        </button>
        <h1 className="text-xl font-bold text-white">Профиль</h1>
        <div className="flex-1" />
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-white"
        >
          Выйти
        </button>
      </header>

      <main className="flex-1 flex justify-center px-6 py-10">
        {loading ? (
          <p className="text-slate-400">Загрузка…</p>
        ) : !profile ? (
          <p className="text-red-400">Не удалось загрузить профиль</p>
        ) : (
          <div className="w-full max-w-md space-y-6">
            {/* Avatar + username */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-[hsl(216,34%,20%)] border border-[hsl(216,34%,30%)] overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl text-slate-500">
                    {(profile.alias ?? profile.userName).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-white font-semibold text-lg">
                  {profile.alias ?? profile.userName}
                </p>
                {profile.alias && (
                  <p className="text-slate-500 text-sm">@{profile.userName}</p>
                )}
              </div>
            </div>

            {/* Change alias */}
            <div className="bg-[hsl(222,47%,15%)] rounded-xl p-5 border border-[hsl(216,34%,25%)] space-y-4">
              <h2 className="text-white font-medium">Псевдоним</h2>
              <form onSubmit={handleSaveAlias} className="space-y-3">
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={profile.userName}
                  maxLength={32}
                  className="w-full px-3 py-2 rounded-lg bg-[hsl(216,34%,20%)] border border-[hsl(216,34%,30%)] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                {saveError && (
                  <p className="text-red-400 text-sm">{saveError}</p>
                )}
                {saveSuccess && (
                  <p className="text-green-400 text-sm">Псевдоним сохранён</p>
                )}
                <button
                  type="submit"
                  disabled={saving || alias.trim() === (profile.alias ?? "")}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors"
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
