import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { remove } from "@tauri-apps/plugin-fs";
import { useParams, useNavigate } from "react-router-dom";

import { thumbnailUrl, mediaUrl } from "../api/client";
import { checkForUpdate } from "../api/games";
import { MediaType } from "../api/types";
import type { GameAction, SavePath } from "../api/types";
import DownloadProgress from "../components/DownloadProgress";
import { useGame } from "../hooks/useGames";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const {
    serverUrl,
    installDir,
    getGameInstalled,
    setGameInstalled,
    removeGameInstalled,
  } = useSettingsStore();

  const { data: game, isLoading, error } = useGame(id!);
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [saveSyncing, setSaveSyncing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showDownload, setShowDownload] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [validating, setValidating] = useState(false);
  const [conflicts, setConflicts] = useState<
    { path: string; missing: boolean }[] | null
  >(null);

  const installed = id ? getGameInstalled(id) : undefined;

  useEffect(() => {
    if (!game || !installed?.installed || !installed.version) return;
    checkForUpdate(game.id, installed.version)
      .then(setUpdateAvailable)
      .catch(() => {});
  }, [game?.id, installed?.installed, installed?.version]);

  async function handleInstall() {
    if (!game || !token) return;
    setInstalling(true);
    setShowDownload(true);
    setActionError("");
    try {
      const installPath = await invoke<string>("download_and_install_game", {
        gameId: game.id,
        serverUrl,
        token,
        installDir,
      });
      const version = (game.archives ?? [])[0]?.version;
      await setGameInstalled(game.id, installPath, version);
      setUpdateAvailable(false);
      // Install scripts (type 0), then NameChange (type 2)
      for (const scriptType of [0, 2]) {
        try {
          await invoke("run_game_scripts", {
            gameId: game.id,
            scriptType,
            serverUrl,
            token,
            installPath,
          });
        } catch (e: unknown) {
          setActionError(e instanceof Error ? e.message : String(e));
          break;
        }
      }
      setShowDownload(false);
      setInstallSuccess(true);
    } catch (e) {
      setShowDownload(false);
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall() {
    if (!installed?.installPath) return;
    setUninstalling(true);
    setActionError("");
    try {
      // Uninstall scripts (type 1) — запускаем до удаления файлов
      await invoke("run_game_scripts", {
        gameId: game!.id,
        scriptType: 1,
        serverUrl,
        token,
        installPath: installed.installPath,
      }).catch(() => {});
      await remove(installed.installPath, { recursive: true });
      await removeGameInstalled(game!.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setUninstalling(false);
    }
  }

  function getSavePaths(): SavePath[] {
    return (game?.savePaths ?? []).filter((sp) => sp.type === 0);
  }

  async function handleDownloadSave() {
    if (!game || !token || !installed?.installPath) return;
    setSaveSyncing(true);
    setActionError("");
    try {
      await invoke("download_save", {
        gameId: game.id,
        serverUrl,
        token,
        installPath: installed.installPath,
        savePaths: getSavePaths(),
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveSyncing(false);
    }
  }

  async function handleUploadSave() {
    if (!game || !token || !installed?.installPath) return;
    setSaveSyncing(true);
    setActionError("");
    try {
      await invoke("upload_save", {
        gameId: game.id,
        serverUrl,
        token,
        installPath: installed.installPath,
        savePaths: getSavePaths(),
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveSyncing(false);
    }
  }

  async function handleValidate() {
    if (!game || !token || !installed?.installPath || !installed.version)
      return;
    setValidating(true);
    setConflicts(null);
    setActionError("");
    try {
      const result = await invoke<{ path: string; missing: boolean }[]>(
        "validate_files",
        {
          gameId: game.id,
          version: installed.version,
          serverUrl,
          token,
          installPath: installed.installPath,
        },
      );
      setConflicts(result);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setValidating(false);
    }
  }

  async function handleLaunch(action: GameAction) {
    if (!game || !token || !installed?.installPath) return;
    setLaunching(true);
    setActionError("");
    try {
      await invoke("launch_game", {
        gameId: game.id,
        action: {
          executable: action.executable,
          arguments: action.arguments,
          working_dir: action.workingDirectory,
        },
        installPath: installed.installPath,
        serverUrl,
        token,
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setLaunching(false);
    }
  }

  const actions = game?.actions ?? [];
  const primaryAction = actions.find((a) => a.primaryAction) ?? actions[0];

  const media = game?.media ?? [];
  const cover = media.find((m) => m.type === MediaType.Cover);
  const background = media.find((m) => m.type === MediaType.Background);
  const logo = media.find((m) => m.type === MediaType.Logo);
  const screenshots = media.filter((m) => m.type === MediaType.Screenshot);
  const heroMedia = background ?? screenshots[0] ?? cover;
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Загрузка…
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-red-400">
        <p>Ошибка загрузки игры</p>
        <button
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white text-sm"
        >
          ← Назад
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)]">
      {/* Hero */}
      <div className="relative h-80 overflow-hidden">
        {heroMedia ? (
          <img
            src={mediaUrl(heroMedia.id, heroMedia.fileId)}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-slate-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222,47%,11%)] via-[hsl(222,47%,11%)]/40 to-transparent" />
      </div>

      {/* Lightbox */}
      {activeScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setActiveScreenshot(null)}
        >
          <img
            src={activeScreenshot}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}

      {/* Content */}
      <div className="px-6 -mt-24 relative pb-12">
        <div className="flex gap-6 items-end mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white text-sm mb-1"
          >
            ← Назад
          </button>
          {cover && (
            <img
              src={thumbnailUrl(cover.id)}
              alt={game.title}
              className="w-32 rounded-lg shadow-lg flex-shrink-0"
            />
          )}
          <div className="flex-1">
            {logo ? (
              <img
                src={mediaUrl(logo.id, logo.fileId)}
                alt={game.title}
                className="max-h-20 max-w-xs object-contain mb-2"
              />
            ) : (
              <h1 className="text-3xl font-bold text-white">{game.title}</h1>
            )}
            {(game.developers ?? []).length > 0 && (
              <p className="text-slate-400 mt-1">
                {(game.developers ?? []).map((d) => d.name).join(", ")}
              </p>
            )}
            {(game.genres ?? []).length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {(game.genres ?? []).map((g) => (
                  <span
                    key={g.id}
                    className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 items-end">
            {installed?.installed ? (
              <>
                {primaryAction && (
                  <button
                    onClick={() => handleLaunch(primaryAction)}
                    disabled={launching}
                    className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold"
                  >
                    {launching ? "Запуск…" : "▶ Играть"}
                  </button>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      invoke("open_dir", { path: installed.installPath })
                    }
                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                    title="Открыть папку с игрой"
                  >
                    📁
                  </button>
                  <button
                    onClick={handleUninstall}
                    disabled={uninstalling}
                    className="px-4 py-1.5 text-sm rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                  >
                    {uninstalling ? "Удаление…" : "Удалить"}
                  </button>
                </div>
                {installed?.version && (
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 transition-colors"
                    title="Проверить целостность файлов"
                  >
                    {validating ? "Проверка…" : "⟳ Проверить файлы"}
                  </button>
                )}
                {getSavePaths().length > 0 && (
                  <div className="flex gap-1">
                    <button
                      onClick={handleDownloadSave}
                      disabled={saveSyncing}
                      className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 transition-colors"
                      title="Загрузить сохранение с сервера"
                    >
                      {saveSyncing ? "…" : "↓ Сейв"}
                    </button>
                    <button
                      onClick={handleUploadSave}
                      disabled={saveSyncing}
                      className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 transition-colors"
                      title="Загрузить сохранение на сервер"
                    >
                      {saveSyncing ? "…" : "↑ Сейв"}
                    </button>
                  </div>
                )}
                {actions.length > 1 && (
                  <div className="flex flex-col gap-1">
                    {actions
                      .filter((a) => !a.primaryAction)
                      .map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleLaunch(action)}
                          disabled={launching}
                          className="px-4 py-1.5 text-sm rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white"
                        >
                          {action.name}
                        </button>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold"
              >
                {installing ? "Установка…" : "↓ Установить"}
              </button>
            )}
            {installed?.installed && updateAvailable && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="px-4 py-1.5 text-sm rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold"
              >
                {installing ? "Обновление…" : "↑ Обновить"}
              </button>
            )}
          </div>
        </div>

        {/* Download progress / install status */}
        {showDownload && id && (
          <div className="mb-4">
            <DownloadProgress gameId={id} />
          </div>
        )}
        {installSuccess && !showDownload && (
          <p className="text-green-400 text-sm mb-4">✓ Установлено</p>
        )}

        {/* Error */}
        {actionError && (
          <p className="text-red-400 text-sm mb-4">{actionError}</p>
        )}

        {/* File validation results */}
        {conflicts !== null && (
          <div className="mb-4 max-w-2xl">
            {conflicts.length === 0 ? (
              <p className="text-green-400 text-sm">Все файлы в порядке</p>
            ) : (
              <div>
                <p className="text-amber-400 text-sm mb-2">
                  Повреждено или отсутствует файлов: {conflicts.length}
                </p>
                <ul className="text-xs text-slate-400 space-y-0.5 max-h-32 overflow-y-auto mb-2">
                  {conflicts.map((c) => (
                    <li key={c.path} className="truncate">
                      {c.missing ? "✗ отсутствует" : "✗ повреждён"} — {c.path}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
                >
                  {installing ? "Установка…" : "Переустановить"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {game.description && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-white mb-2">Описание</h2>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
              {game.description}
            </p>
          </div>
        )}

        {/* Screenshots */}
        {screenshots.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-3">Скриншоты</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {screenshots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveScreenshot(mediaUrl(s.id, s.fileId))}
                  className="flex-shrink-0 rounded-lg overflow-hidden border border-slate-700 hover:border-blue-500 transition-colors"
                >
                  <img
                    src={thumbnailUrl(s.id)}
                    alt=""
                    className="h-36 w-auto object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="mt-6 grid grid-cols-2 gap-4 max-w-md text-sm">
          {game.releasedOn && (
            <div>
              <span className="text-slate-500">Год выхода</span>
              <p className="text-white">
                {new Date(game.releasedOn).getFullYear()}
              </p>
            </div>
          )}
          {(game.publishers ?? []).length > 0 && (
            <div>
              <span className="text-slate-500">Издатель</span>
              <p className="text-white">
                {(game.publishers ?? []).map((p) => p.name).join(", ")}
              </p>
            </div>
          )}
          {(game.platforms ?? []).length > 0 && (
            <div>
              <span className="text-slate-500">Платформы</span>
              <p className="text-white">
                {(game.platforms ?? []).map((p) => p.name).join(", ")}
              </p>
            </div>
          )}
          {(game.archives ?? [])[0] && (
            <div>
              <span className="text-slate-500">Версия</span>
              <p className="text-white">{(game.archives ?? [])[0].version}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
