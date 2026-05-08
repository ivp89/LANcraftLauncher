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
  installedGames: Record<string, InstalledGame>;
  setServerUrl: (url: string) => Promise<void>;
  setInstallDir: (dir: string) => Promise<void>;
  setGameInstalled: (gameId: string, installPath: string, version?: string) => Promise<void>;
  removeGameInstalled: (gameId: string) => Promise<void>;
  getGameInstalled: (gameId: string) => InstalledGame | undefined;
  loadFromStore: () => Promise<void>;
}

async function getDefaultInstallDir(): Promise<string> {
  try {
    const home = await invoke<string>("get_home_dir");
    const sep = home.endsWith("/") || home.endsWith("\\") ? "" : "/";
    return `${home}${sep}Games`;
  } catch {
    return navigator.platform.startsWith("Win") ? "C:\\Games" : "/tmp/Games";
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  serverUrl: "",
  installDir: "",
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
    const installedGames =
      (await store
        .get<Record<string, InstalledGame>>("installedGames")
        .catch(() => null)) ?? {};

    set({
      serverUrl: serverUrl ?? "",
      installDir:
        installDir ?? (await getDefaultInstallDir().catch(() => "/Games")),
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
