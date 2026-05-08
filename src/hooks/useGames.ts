import { useQuery } from "@tanstack/react-query";

import { getLibrary, getGame, getAllGames } from "../api/games";
import { useAuthStore } from "../stores/authStore";

export function useLibrary() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["library"],
    queryFn: getLibrary,
    enabled: !!token,
  });
}

export function useGame(id: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["game", id],
    queryFn: () => getGame(id),
    enabled: !!token && !!id,
  });
}

export function useAllGames() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["games"],
    queryFn: getAllGames,
    enabled: !!token,
  });
}
