import { useQuery } from "@tanstack/react-query";

import { getLibrary, getGame, getAllGames, getDepot, getGameActions } from "../api/games";
import { getProfile } from "../api/profile";
import { useAuthStore } from "../stores/authStore";
import { useConnectivityStore } from "../stores/connectivityStore";
import { useGameCacheStore } from "../stores/gameCacheStore";
import { useSettingsStore } from "../stores/settingsStore";

export function useProfile() {
  const token = useAuthStore((s) => s.token);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const setLocalAlias = useSettingsStore((s) => s.setLocalAlias);

  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const result = await getProfile();
      const alias = result.alias ?? result.userName ?? "";
      if (alias) setLocalAlias(alias).catch(() => {});
      return result;
    },
    enabled: !!token && isOnline,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLibrary() {
  const token = useAuthStore((s) => s.token);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  return useQuery({
    queryKey: ["library"],
    queryFn: getLibrary,
    enabled: !!token && isOnline,
  });
}

export function useGame(id: string) {
  const token = useAuthStore((s) => s.token);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const cachedGame = useGameCacheStore((s) => s.gameDetails[id]);
  const setGameDetail = useGameCacheStore((s) => s.setGameDetail);

  return useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      const result = await getGame(id);
      setGameDetail(id, result).catch(() => {});
      return result;
    },
    enabled: !!token && !!id && isOnline,
    placeholderData: cachedGame,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllGames() {
  const token = useAuthStore((s) => s.token);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const cachedGames = useGameCacheStore((s) => s.games);
  const setGames = useGameCacheStore((s) => s.setGames);

  return useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const result = await getAllGames();
      setGames(result).catch(() => {});
      return result;
    },
    enabled: !!token && isOnline,
    placeholderData: cachedGames ?? undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGameActions(id: string) {
  const token = useAuthStore((s) => s.token);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const cachedActions = useGameCacheStore((s) => s.gameActions[id]);
  const setGameActions = useGameCacheStore((s) => s.setGameActions);

  return useQuery({
    queryKey: ["gameActions", id],
    queryFn: async () => {
      const result = await getGameActions(id);
      setGameActions(id, result).catch(() => {});
      return result;
    },
    enabled: !!token && !!id && isOnline,
    placeholderData: cachedActions,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDepot() {
  const token = useAuthStore((s) => s.token);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const cachedDepot = useGameCacheStore((s) => s.depot);
  const setDepot = useGameCacheStore((s) => s.setDepot);

  return useQuery({
    queryKey: ["depot"],
    queryFn: async () => {
      const result = await getDepot();
      setDepot(result).catch(() => {});
      return result;
    },
    enabled: !!token && isOnline,
    placeholderData: cachedDepot ?? undefined,
    staleTime: 5 * 60 * 1000,
  });
}
