import { create } from "zustand";

interface GameStateStore {
  downloadingGames: Set<string>;
  runningGames: Set<string>;
  setGameDownloading: (gameId: string, value: boolean) => void;
  setGameRunning: (gameId: string, value: boolean) => void;
}

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  downloadingGames: new Set(),
  runningGames: new Set(),

  setGameDownloading: (gameId, value) => {
    const next = new Set(get().downloadingGames);
    if (value) next.add(gameId);
    else next.delete(gameId);
    set({ downloadingGames: next });
  },

  setGameRunning: (gameId, value) => {
    const next = new Set(get().runningGames);
    if (value) next.add(gameId);
    else next.delete(gameId);
    set({ runningGames: next });
  },
}));
