import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

import { getProfile, changeAlias, fetchAvatarBlob } from "../api/profile";
import type { UserProfile } from "../api/profile";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

const SCRIPT_TYPE_NAME_CHANGE = 2;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { installDir, scriptDebugging, setInstallDir, setScriptDebugging } =
    useSettingsStore();
  const [logPath, setLogPath] = useState<string | null>(null);
  const [dirInput, setDirInput] = useState(installDir);
  const [dirSaved, setDirSaved] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasError, setAliasError] = useState("");
  const [aliasSuccess, setAliasSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    invoke<string | null>("get_log_path").then(setLogPath).catch(() => {});
  }, []);

  useEffect(() => {
    let blobUrl: string | null = null;
    async function load() {
      try {
        const [p, blob] = await Promise.all([getProfile(), fetchAvatarBlob()]);
        setProfile(p);
        setAlias(p.alias ?? "");
        blobUrl = blob;
        setAvatarUrl(blob);
      } catch {}
      finally {
        setProfileLoading(false);
      }
    }
    load();
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, []);

  async function handleSaveDir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await setInstallDir(dirInput.trim());
    setDirSaved(true);
    setTimeout(() => setDirSaved(false), 3000);
  }

  async function handleSaveAlias(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAliasSaving(true);
    setAliasError("");
    setAliasSuccess(false);
    try {
      await changeAlias(alias.trim());
      setProfile((p) => (p ? { ...p, alias: alias.trim() } : p));

      const { installedGames, serverUrl, scriptDebugging: dbg } = useSettingsStore.getState();
      const { token } = useAuthStore.getState();
      const entries = Object.entries(installedGames).filter(([, g]) => g.installed);
      if (entries.length > 0 && token) {
        await Promise.allSettled(
          entries.map(([gameId, g]) =>
            invoke("run_game_scripts", {
              gameId,
              scriptType: SCRIPT_TYPE_NAME_CHANGE,
              serverUrl,
              token,
              installPath: g.installPath,
              debug: dbg,
            }),
          ),
        );
      }
      setAliasSuccess(true);
      setTimeout(() => setAliasSuccess(false), 3000);
    } catch (err) {
      setAliasError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setAliasSaving(false);
    }
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
        <h1 className="text-xl font-bold text-white">Настройки</h1>
      </header>

      <main className="flex-1 flex justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-6">

          {/* Profile */}
          {!profileLoading && profile && (
            <>
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-[hsl(216,34%,20%)] border border-[hsl(216,34%,30%)] overflow-hidden flex items-center justify-center flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-slate-500">
                      {(profile.alias ?? profile.userName).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-white font-semibold">{profile.alias ?? profile.userName}</p>
                  {profile.alias && (
                    <p className="text-slate-500 text-sm">@{profile.userName}</p>
                  )}
                </div>
              </div>

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
                  {aliasError && <p className="text-red-400 text-sm">{aliasError}</p>}
                  {aliasSuccess && <p className="text-green-400 text-sm">✓ Псевдоним сохранён</p>}
                  <button
                    type="submit"
                    disabled={aliasSaving || alias.trim() === (profile.alias ?? "")}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors"
                  >
                    {aliasSaving ? "Сохранение…" : "Сохранить"}
                  </button>
                </form>
              </div>
            </>
          )}

          {/* Install directory */}
          <div className="bg-[hsl(222,47%,15%)] rounded-xl p-5 border border-[hsl(216,34%,25%)] space-y-4">
            <h2 className="text-white font-medium">Директория установки</h2>
            <form onSubmit={handleSaveDir} className="space-y-3">
              <input
                type="text"
                value={dirInput}
                onChange={(e) => setDirInput(e.target.value)}
                placeholder="Путь к папке с играми"
                className="w-full px-3 py-2 rounded-lg bg-[hsl(216,34%,20%)] border border-[hsl(216,34%,30%)] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              {dirSaved && <p className="text-green-400 text-sm">✓ Сохранено</p>}
              <button
                type="submit"
                disabled={dirInput.trim() === installDir || !dirInput.trim()}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors"
              >
                Сохранить
              </button>
            </form>
          </div>

          {/* Log path */}
          {logPath && (
            <div className="bg-[hsl(222,47%,15%)] rounded-xl p-5 border border-[hsl(216,34%,25%)]">
              <h2 className="text-white font-medium mb-2">Файл логов</h2>
              <p className="text-slate-400 text-xs font-mono break-all">{logPath}</p>
              <button
                onClick={() => invoke("open_dir", { path: logPath })}
                className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Открыть папку
              </button>
            </div>
          )}

          {/* Script debugging */}
          <div className="bg-[hsl(222,47%,15%)] rounded-xl p-5 border border-[hsl(216,34%,25%)]">
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={scriptDebugging}
                  onChange={(e) => setScriptDebugging(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${scriptDebugging ? "bg-blue-600" : "bg-slate-600"}`} />
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${scriptDebugging ? "translate-x-5" : "translate-x-1"}`} />
              </div>
              <div>
                <p className="text-white font-medium">Отладка скриптов</p>
                <p className="text-slate-400 text-sm mt-0.5">
                  На Windows показывает окно PowerShell при выполнении скриптов.
                  На macOS/Linux выводит stdout/stderr в консоль.
                </p>
              </div>
            </label>
          </div>

        </div>
      </main>
    </div>
  );
}
