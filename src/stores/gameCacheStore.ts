import { LazyStore } from "@tauri-apps/plugin-store";
import { create } from "zustand";

import type { DepotResult, Game, GameAction } from "@/api/types";

const store = new LazyStore("game-cache.json");

interface GameCacheState {
  games: Game[] | null;
  depot: DepotResult | null;
  gameDetails: Record<string, Game>;
  gameActions: Record<string, GameAction[]>;
  setGames: (games: Game[]) => Promise<void>;
  setDepot: (depot: DepotResult) => Promise<void>;
  setGameDetail: (id: string, game: Game) => Promise<void>;
  setGameActions: (id: string, actions: GameAction[]) => Promise<void>;
  loadFromStore: () => Promise<void>;
}

export const useGameCacheStore = create<GameCacheState>((set, get) => ({
  games: null,
  depot: null,
  gameDetails: {},
  gameActions: {},

  setGames: async (games: Game[]) => {
    const details = { ...get().gameDetails };
    for (const g of games) details[g.id] = g;
    await store.set("games", games);
    await store.set("gameDetails", details);
    await store.save();
    set({ games, gameDetails: details });
  },

  setDepot: async (depot: DepotResult) => {
    await store.set("depot", depot);
    await store.save();
    set({ depot });
  },

  setGameDetail: async (id: string, game: Game) => {
    const gameDetails = { ...get().gameDetails, [id]: game };
    await store.set("gameDetails", gameDetails);
    await store.save();
    set({ gameDetails });
  },

  setGameActions: async (id: string, actions: GameAction[]) => {
    const gameActions = { ...get().gameActions, [id]: actions };
    await store.set("gameActions", gameActions);
    await store.save();
    set({ gameActions });
  },

  loadFromStore: async () => {
    const games = await store.get<Game[]>("games").catch(() => null);
    const depot = await store.get<DepotResult>("depot").catch(() => null);
    const gameDetails = (await store.get<Record<string, Game>>("gameDetails").catch(() => null)) ?? {};
    const gameActions = (await store.get<Record<string, GameAction[]>>("gameActions").catch(() => null)) ?? {};
    set({ games: games ?? null, depot: depot ?? null, gameDetails, gameActions });
  },
}));
