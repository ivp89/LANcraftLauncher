import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { logout } from "../api/auth";
import { GameType } from "../api/types";
import type { Game } from "../api/types";
import GameCard from "../components/GameCard";
import { useAllGames } from "../hooks/useGames";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

export default function LibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, clearAuth } = useAuthStore();
  const { serverUrl } = useSettingsStore();
  const { data: games, isLoading, error } = useAllGames();

  const [search, setSearch] = useState("");
  const [filterInstalled, setFilterInstalled] = useState(false);
  const { installedGames } = useSettingsStore();

  const filtered = useMemo<Game[]>(() => {
    if (!games) return [];
    return games.filter((g) => {
      if (g.type !== GameType.MainGame) return false;
      if (filterInstalled && !installedGames[g.id]?.installed) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          g.title.toLowerCase().includes(q) ||
          (g.genres ?? []).some((genre) => genre.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [games, search, filterInstalled, installedGames]);

  async function handleLogout() {
    if (token) await logout(serverUrl, token);
    await clearAuth();
    queryClient.clear();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[hsl(222,47%,11%)]/90 backdrop-blur border-b border-[hsl(216,34%,20%)] px-6 py-3 flex items-center gap-4">
        <h1 className="text-xl font-bold text-white">LANcraft</h1>
        <div className="flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск игр…"
            className="w-full max-w-sm px-3 py-1.5 text-sm rounded-lg bg-[hsl(216,34%,20%)] border border-[hsl(216,34%,30%)] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setFilterInstalled((v) => !v)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filterInstalled
              ? "bg-blue-600 border-blue-600 text-white"
              : "border-[hsl(216,34%,30%)] text-slate-400 hover:text-white"
          }`}
        >
          Установленные
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-white"
        >
          Профиль
        </button>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-white"
        >
          Выйти
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6">
        {isLoading && (
          <div className="flex items-center justify-center h-64 text-slate-400">
            Загрузка библиотеки…
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64 text-red-400">
            Ошибка загрузки:{" "}
            {error instanceof Error ? error.message : "Неизвестная ошибка"}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex items-center justify-center h-64 text-slate-400">
            {search ? "Игры не найдены" : "Библиотека пуста"}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <>
            <p className="text-slate-500 text-sm mb-4">
              {filtered.length} игр{filtered.length === 1 ? "а" : ""}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
              {filtered.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
