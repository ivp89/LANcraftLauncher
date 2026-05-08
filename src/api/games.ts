import { apiFetch } from "./client";
import type { Game, GameAction, EntityReference } from "./types";

export async function getLibrary(): Promise<EntityReference[]> {
  return apiFetch<EntityReference[]>("/api/Library");
}

export async function getGame(id: string): Promise<Game> {
  return apiFetch<Game>(`/api/Games/${id}`);
}

export async function getAllGames(): Promise<Game[]> {
  return apiFetch<Game[]>("/api/Games");
}

export async function getGameActions(id: string): Promise<GameAction[]> {
  return apiFetch<GameAction[]>(`/api/Games/${id}/Actions`);
}

export async function notifyGameStarted(id: string): Promise<void> {
  return apiFetch<void>(`/api/Games/${id}/Started`);
}

export async function notifyGameStopped(id: string): Promise<void> {
  return apiFetch<void>(`/api/Games/${id}/Stopped`);
}

export async function checkForUpdate(id: string, version: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/Games/${id}/CheckForUpdate?version=${encodeURIComponent(version)}`);
}

export async function addToLibrary(gameId: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/Library/AddToLibrary/${gameId}`, {
    method: "POST",
  });
}

export async function removeFromLibrary(gameId: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/Library/RemoveFromLibrary/${gameId}`, {
    method: "POST",
  });
}
