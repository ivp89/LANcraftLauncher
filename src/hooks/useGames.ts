import { useQuery } from "@tanstack/react-query";

import { getLibrary, getGame, getAllGames, getDepot } from "../api/games";
import { getProfile } from "../api/profile";
import { useAuthStore } from "../stores/authStore";

export function useProfile() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}

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

export function useDepot() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["depot"],
    queryFn: getDepot,
    enabled: !!token,
  });
}
