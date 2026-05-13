import { memo, useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import clsx from "clsx";

import { checkForUpdate } from "@/api/games";
import type { GameAction } from "@/api/types";
import { useGame, useGameActions } from "@/hooks/useGames";
import { useAuthStore } from "@/stores/authStore";
import { useConnectivityStore } from "@/stores/connectivityStore";
import { useGameStateStore } from "@/stores/gameStateStore";
import { useSettingsStore } from "@/stores/settingsStore";

import GameInstallProgress from "./GameInstallProgress";
import GameLaunchButton from "./GameLaunchButton";
import GameManageButtons from "./GameManageButtons";
import GameSaveButtons from "./GameSaveButtons";

interface Props {
  gameId: string;
}

const GameActionsPanel = memo(function GameActionsPanel({ gameId }: Props) {
  const { token } = useAuthStore();
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const { serverUrl, installDir, scriptDebugging, getGameInstalled, setGameInstalled, removeGameInstalled } =
    useSettingsStore();
  const { downloadingGames, runningGames, setGameDownloading, setGameRunning } = useGameStateStore();
  const { data: game } = useGame(gameId);
  const { data: actions = [] } = useGameActions(gameId);

  const installing = downloadingGames.has(gameId);
  const running = runningGames.has(gameId);
  const installed = getGameInstalled(gameId);

  const [launching, setLaunching] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [saveSyncing, setSaveSyncing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [installSuccess, setInstallSuccess] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!game || !installed?.installed || !installed.version) return;
    checkForUpdate(game.id, installed.version)
      .then(setUpdateAvailable)
      .catch(() => {});
  }, [game?.id, installed?.installed, installed?.version]);

  useEffect(() => {
    const unlistenPromise = listen<string>("game-exited", (event) => {
      if (event.payload === gameId) setGameRunning(event.payload, false);
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [gameId]);

  const handleInstall = useCallback(async () => {
    if (!game || !token) return;
    setGameDownloading(game.id, true);
    setActionError("");
    try {
      const installPath = await invoke<string>("download_and_install_game", {
        gameId: game.id,
        gameTitle: game.title,
        serverUrl,
        token,
        installDir,
      });
      const version = (game.archives ?? [])[0]?.version;
      await setGameInstalled(game.id, installPath, version);
      setUpdateAvailable(false);
      for (const scriptType of [0, 2]) {
        try {
          await invoke("run_game_scripts", {
            gameId: game.id,
            scriptType,
            serverUrl,
            token,
            installPath,
            debug: scriptDebugging,
          });
        } catch (e: unknown) {
          setActionError(e instanceof Error ? e.message : String(e));
          break;
        }
      }
      setInstallSuccess(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "cancelled") setActionError(msg);
    } finally {
      setGameDownloading(game.id, false);
    }
  }, [game, token, serverUrl, installDir, scriptDebugging, setGameDownloading, setGameInstalled]);

  const handleCancelInstall = useCallback(() => {
    invoke("cancel_download", { gameId }).catch(() => {});
  }, [gameId]);

  const handleUninstall = useCallback(async () => {
    if (!game || !installed?.installPath) return;
    setUninstalling(true);
    setActionError("");
    try {
      await invoke("run_game_scripts", {
        gameId: game.id,
        scriptType: 1,
        serverUrl,
        token,
        installPath: installed.installPath,
        debug: scriptDebugging,
      }).catch(() => {});
      await invoke("remove_dir", { path: installed.installPath });
      await removeGameInstalled(game.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setUninstalling(false);
    }
  }, [game, installed?.installPath, serverUrl, token, scriptDebugging, removeGameInstalled]);

  const handleDownloadSave = useCallback(async () => {
    if (!game || !token || !installed?.installPath) return;
    setSaveSyncing(true);
    setActionError("");
    try {
      await invoke("download_save", {
        gameId: game.id,
        serverUrl,
        token,
        installPath: installed.installPath,
        savePaths: (game.savePaths ?? []).filter((sp) => sp.type === 0),
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveSyncing(false);
    }
  }, [game, token, installed?.installPath, serverUrl]);

  const handleUploadSave = useCallback(async () => {
    if (!game || !token || !installed?.installPath) return;
    setSaveSyncing(true);
    setActionError("");
    try {
      await invoke("upload_save", {
        gameId: game.id,
        serverUrl,
        token,
        installPath: installed.installPath,
        savePaths: (game.savePaths ?? []).filter((sp) => sp.type === 0),
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveSyncing(false);
    }
  }, [game, token, installed?.installPath, serverUrl]);

  const handleLaunch = useCallback(
    async (action: GameAction) => {
      if (!game || !token || !installed?.installPath) return;
      setLaunching(true);
      setActionError("");
      try {
        await invoke("launch_game", {
          gameId: game.id,
          action: {
            executable: action.path,
            arguments: action.arguments,
            working_dir: action.workingDirectory,
            variables: action.variables ?? {},
          },
          installPath: installed.installPath,
          serverUrl,
          token,
          debug: scriptDebugging,
        });
        setGameRunning(game.id, true);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : String(e));
      } finally {
        setLaunching(false);
      }
    },
    [game, token, installed?.installPath, serverUrl, scriptDebugging, setGameRunning],
  );

  if (!game) return null;

  const primaryAction = actions.find((a) => a.isPrimaryAction) ?? actions[0];
  const savePaths = (game.savePaths ?? []).filter((sp) => sp.type === 0);

  return (
    <div className="flex flex-col items-end gap-2">
      {installed?.installed ? (
        <>
          {primaryAction && (
            <GameLaunchButton
              gameId={gameId}
              actions={actions}
              primaryAction={primaryAction}
              running={running}
              launching={launching}
              onLaunch={handleLaunch}
            />
          )}
          <GameManageButtons
            installPath={installed.installPath}
            uninstalling={uninstalling}
            onUninstall={handleUninstall}
          />
          {savePaths.length > 0 && (
            <GameSaveButtons
              saveSyncing={saveSyncing}
              onDownload={handleDownloadSave}
              onUpload={handleUploadSave}
              disabled={!isOnline}
            />
          )}
        </>
      ) : (
        <button
          onClick={handleInstall}
          disabled={installing || !isOnline}
          className={clsx(
            "rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white",
            "hover:bg-blue-500",
            "disabled:opacity-50",
          )}
          title={!isOnline ? "Недоступно офлайн" : undefined}
        >
          {installing ? "Установка…" : "↓ Установить"}
        </button>
      )}
      {installed?.installed && updateAvailable && (
        <button
          onClick={handleInstall}
          disabled={installing || !isOnline}
          className={clsx(
            "rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white",
            "hover:bg-amber-500",
            "disabled:opacity-50",
          )}
          title={!isOnline ? "Недоступно офлайн" : undefined}
        >
          {installing ? "Обновление…" : "↑ Обновить"}
        </button>
      )}

      <GameInstallProgress
        gameId={gameId}
        installing={installing}
        installSuccess={installSuccess}
        onCancel={handleCancelInstall}
      />

      {actionError && <p className="mt-1 text-sm text-red-400">{actionError}</p>}
    </div>
  );
});

export default GameActionsPanel;
