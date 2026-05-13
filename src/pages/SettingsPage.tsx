import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";

import { changeAlias, fetchAvatarBlob } from "../api/profile";
import { useProfile } from "../hooks/useGames";
import { useAuthStore } from "../stores/authStore";
import { useConnectivityStore } from "../stores/connectivityStore";
import { useSettingsStore } from "../stores/settingsStore";

const SCRIPT_TYPE_NAME_CHANGE = 2;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { serverUrl, installDir, scriptDebugging, localAlias, setInstallDir, setScriptDebugging } = useSettingsStore();
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [dirInput, setDirInput] = useState(installDir);

  useEffect(() => {
    setDirInput(installDir);
  }, [installDir]);
  const [dirSaved, setDirSaved] = useState(false);

  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasError, setAliasError] = useState("");
  const [aliasSuccess, setAliasSuccess] = useState(false);

  useEffect(() => {
    invoke<string | null>("get_log_path")
      .then(setLogPath)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (profile) setAlias(profile.alias ?? "");
    else if (!isOnline && localAlias) setAlias(localAlias);
  }, [profile, isOnline, localAlias]);

  useEffect(() => {
    if (!serverUrl) return;
    let blobUrl: string | null = null;
    fetchAvatarBlob()
      .then((url) => {
        blobUrl = url;
        setAvatarUrl(url);
      })
      .catch(() => {});
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [serverUrl]);

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
      const newAlias = alias.trim();
      if (isOnline) {
        await changeAlias(newAlias);
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }

      const { installedGames, serverUrl: sv, scriptDebugging: dbg, setLocalAlias } = useSettingsStore.getState();
      const { token } = useAuthStore.getState();
      await setLocalAlias(newAlias);
      const entries = Object.entries(installedGames).filter(([, g]) => g.installed);
      if (entries.length > 0 && token) {
        await Promise.allSettled(
          entries.map(([gameId, g]) =>
            invoke("run_game_scripts", {
              gameId,
              scriptType: SCRIPT_TYPE_NAME_CHANGE,
              serverUrl: sv,
              token,
              installPath: g.installPath,
              newPlayerAlias: newAlias,
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
    <div className="flex min-h-screen flex-col bg-[hsl(222,47%,11%)]">
      <header
        className={clsx(
          "sticky top-0 z-10",
          "flex items-center gap-4",
          "border-b border-[hsl(216,34%,20%)]",
          "bg-[hsl(222,47%,11%)]/90",
          "px-6 py-3",
          "backdrop-blur",
        )}
      >
        <button onClick={() => navigate("/")} className="text-sm text-slate-400 hover:text-white">
          ← Библиотека
        </button>
        <h1 className="text-xl font-bold text-white">Настройки</h1>
      </header>

      <main className="flex flex-1 justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-6">
          {/* Profile */}
          {!profileLoading && profile && (
            <>
              <div className="flex items-center gap-5">
                <div
                  className={clsx(
                    "flex h-16 w-16 shrink-0 overflow-hidden rounded-full",
                    "border border-[hsl(216,34%,30%)] bg-[hsl(216,34%,20%)]",
                    "items-center justify-center",
                  )}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="h-full w-full object-cover"
                      onError={() => setAvatarUrl(null)}
                    />
                  ) : (
                    <span className="text-2xl text-slate-500">
                      {(profile.alias ?? profile.userName).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-white">{profile.alias ?? profile.userName}</p>
                  {profile.alias && <p className="text-sm text-slate-500">@{profile.userName}</p>}
                </div>
              </div>

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
                      "w-full rounded-lg",
                      "border border-[hsl(216,34%,30%)]",
                      "bg-[hsl(216,34%,20%)]",
                      "px-3 py-2",
                      "text-white placeholder-slate-500",
                      "focus:border-blue-500 focus:outline-none",
                    )}
                  />
                  {aliasError && <p className="text-sm text-red-400">{aliasError}</p>}
                  {aliasSuccess && <p className="text-sm text-green-400">✓ Псевдоним сохранён</p>}
                  <button
                    type="submit"
                    disabled={aliasSaving || alias.trim() === (profile.alias ?? "")}
                    className={clsx(
                      "w-full rounded-lg",
                      "bg-blue-600 hover:bg-blue-500",
                      "py-2 font-medium text-white",
                      "transition-colors",
                      "disabled:opacity-50",
                    )}
                  >
                    {aliasSaving ? "Сохранение…" : "Сохранить"}
                  </button>
                </form>
              </div>
            </>
          )}

          {/* Install directory */}
          <div className="space-y-4 rounded-xl border border-[hsl(216,34%,25%)] bg-[hsl(222,47%,15%)] p-5">
            <h2 className="font-medium text-white">Директория установки</h2>
            <form onSubmit={handleSaveDir} className="space-y-3">
              <input
                type="text"
                value={dirInput}
                onChange={(e) => setDirInput(e.target.value)}
                placeholder="Путь к папке с играми"
                className={clsx(
                  "w-full rounded-lg",
                  "border border-[hsl(216,34%,30%)]",
                  "bg-[hsl(216,34%,20%)]",
                  "px-3 py-2",
                  "font-mono text-sm text-white placeholder-slate-500",
                  "focus:border-blue-500 focus:outline-none",
                )}
              />
              {dirSaved && <p className="text-sm text-green-400">✓ Сохранено</p>}
              <button
                type="submit"
                disabled={dirInput.trim() === installDir || !dirInput.trim()}
                className={clsx(
                  "w-full rounded-lg",
                  "bg-blue-600 hover:bg-blue-500",
                  "py-2 font-medium text-white",
                  "transition-colors",
                  "disabled:opacity-50",
                )}
              >
                Сохранить
              </button>
            </form>
          </div>

          {/* Log path */}
          {logPath && (
            <div className="rounded-xl border border-[hsl(216,34%,25%)] bg-[hsl(222,47%,15%)] p-5">
              <h2 className="mb-2 font-medium text-white">Файл логов</h2>
              <p className="font-mono text-xs break-all text-slate-400">{logPath}</p>
              <button
                onClick={() => invoke("open_dir", { path: logPath })}
                className="mt-2 text-sm text-blue-400 transition-colors hover:text-blue-300"
              >
                Открыть папку
              </button>
            </div>
          )}

          {/* Script debugging */}
          <div className="rounded-xl border border-[hsl(216,34%,25%)] bg-[hsl(222,47%,15%)] p-5">
            <label className="flex cursor-pointer items-start gap-4">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={scriptDebugging}
                  onChange={(e) => setScriptDebugging(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={clsx(
                    "h-6 w-10 rounded-full transition-colors",
                    scriptDebugging ? "bg-blue-600" : "bg-slate-600",
                  )}
                />
                <div
                  className={clsx(
                    "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    scriptDebugging ? "translate-x-5" : "translate-x-1",
                  )}
                />
              </div>
              <div>
                <p className="font-medium text-white">Отладка скриптов</p>
                <p className="mt-0.5 text-sm text-slate-400">
                  На Windows показывает окно PowerShell при выполнении скриптов. На macOS/Linux выводит stdout/stderr в
                  консоль.
                </p>
              </div>
            </label>
          </div>
        </div>
      </main>
    </div>
  );
}
