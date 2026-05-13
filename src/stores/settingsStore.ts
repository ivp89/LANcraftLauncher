import { invoke } from "@tauri-apps/api/core";
import { exists } from "@tauri-apps/plugin-fs";
import { LazyStore } from "@tauri-apps/plugin-store";
import { create } from "zustand";

const store = new LazyStore("settings.json");

interface InstalledGame {
  installed: boolean;
  installPath: string;
  version?: string;
}

interface SettingsState {
  serverUrl: string;
  installDir: string;
  scriptDebugging: boolean;
  installedGames: Record<string, InstalledGame>;
  setServerUrl: (url: string) => Promise<void>;
  setInstallDir: (dir: string) => Promise<void>;
  setScriptDebugging: (v: boolean) => Promise<void>;
  setGameInstalled: (gameId: string, installPath: string, version?: string) => Promise<void>;
  removeGameInstalled: (gameId: string) => Promise<void>;
  getGameInstalled: (gameId: string) => InstalledGame | undefined;
  loadFromStore: () => Promise<void>;
}

async function getDefaultInstallDir(): Promise<string> {
  try {
    return await invoke<string>("get_default_install_dir");
  } catch {
    return navigator.platform.startsWith("Win") ? "C:\\Games" : "/Games";
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  serverUrl: "",
  installDir: "",
  scriptDebugging: false,
  installedGames: {},

  setServerUrl: async (url: string) => {
    await store.set("serverUrl", url);
    await store.save();
    set({ serverUrl: url });
  },

  setInstallDir: async (dir: string) => {
    await store.set("installDir", dir);
    await store.save();
    set({ installDir: dir });
  },

  setScriptDebugging: async (v: boolean) => {
    await store.set("scriptDebugging", v);
    await store.save();
    set({ scriptDebugging: v });
  },

  removeGameInstalled: async (gameId: string) => {
    const installedGames = { ...get().installedGames };
    delete installedGames[gameId];
    await store.set("installedGames", installedGames);
    await store.save();
    set({ installedGames });
  },

  setGameInstalled: async (gameId: string, installPath: string, version?: string) => {
    const installedGames = {
      ...get().installedGames,
      [gameId]: { installed: true, installPath, version },
    };
    await store.set("installedGames", installedGames);
    await store.save();
    set({ installedGames });
  },

  getGameInstalled: (gameId: string) => {
    return get().installedGames[gameId];
  },

  loadFromStore: async () => {
    const serverUrl = await store.get<string>("serverUrl").catch(() => null);
    const installDir = await store.get<string>("installDir").catch(() => null);
    const scriptDebugging = await store.get<boolean>("scriptDebugging").catch(() => null);
    const installedGames =
      (await store
        .get<Record<string, InstalledGame>>("installedGames")
        .catch(() => null)) ?? {};

    set({
      serverUrl: serverUrl ?? "",
      installDir:
        installDir ?? (await getDefaultInstallDir().catch(() => "/Games")),
      scriptDebugging: scriptDebugging ?? false,
      installedGames,
    });

    // Проверяем наличие папок отдельно, чтобы не блокировать загрузку
    const verified: Record<string, InstalledGame> = {};
    await Promise.all(
      Object.entries(installedGames).map(async ([id, info]) => {
        const ok = await exists(info.installPath).catch(() => false);
        if (ok) verified[id] = info;
      }),
    );
    set({ installedGames: verified });
  },
}));
