import { useState, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";

import { logout } from "../api/auth";
import { GameType } from "../api/types";
import type { Game } from "../api/types";
import GameCard from "../components/GameCard";
import { useAllGames, useDepot, useProfile } from "../hooks/useGames";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

const NO_COLLECTION = "\0";

export default function LibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, clearAuth } = useAuthStore();
  const { serverUrl } = useSettingsStore();
  const { data: games, isLoading, error } = useAllGames();
  const { data: depot } = useDepot();

  const [search, setSearch] = useState("");
  const [filterInstalled, setFilterInstalled] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const genreDropdownRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { data: profile } = useProfile();
  const { installedGames } = useSettingsStore();

  useEffect(() => {
    if (!genreDropdownOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(e.target as Node)) setGenreDropdownOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [genreDropdownOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [userMenuOpen]);

  // Map gameId → collection names from depot (games in /api/Games don't include collections)
  const gameCollectionsMap = useMemo<Map<string, string[]>>(() => {
    const map = new Map<string, string[]>();
    (depot?.games ?? []).forEach((dg) => {
      map.set(
        dg.id,
        (dg.collections ?? []).map((c) => c.name),
      );
    });
    return map;
  }, [depot]);

  const allCollections = useMemo<string[]>(
    () => (depot?.collections ?? []).map((c) => c.name).sort((a, b) => a.localeCompare(b)),
    [depot],
  );

  const baseFiltered = useMemo<Game[]>(() => {
    if (!games) return [];
    return games.filter((g) => {
      if (g.type !== GameType.MainGame) return false;
      if (filterInstalled && !installedGames[g.id]?.installed) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          g.title.toLowerCase().includes(q) ||
          (gameCollectionsMap.get(g.id) ?? []).some((name) => name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [games, search, filterInstalled, installedGames, gameCollectionsMap]);

  // Games filtered by selected collection (NO_COLLECTION = games with no collection)
  const filtered = useMemo<Game[]>(() => {
    if (!selectedGenre) return baseFiltered;
    if (selectedGenre === NO_COLLECTION)
      return baseFiltered.filter((g) => (gameCollectionsMap.get(g.id) ?? []).length === 0);
    return baseFiltered.filter((g) => (gameCollectionsMap.get(g.id) ?? []).includes(selectedGenre));
  }, [baseFiltered, selectedGenre, gameCollectionsMap]);

  // Group by collection when no collection selected and no search
  const groupedByGenre = useMemo<{ genre: string; games: Game[] }[]>(() => {
    if (selectedGenre || search) return [];
    const map = new Map<string, Game[]>();
    const noCollection: Game[] = [];

    filtered.forEach((g) => {
      const collections = gameCollectionsMap.get(g.id) ?? [];
      if (collections.length === 0) {
        noCollection.push(g);
      } else {
        collections.forEach((name) => {
          if (!map.has(name)) map.set(name, []);
          map.get(name)!.push(g);
        });
      }
    });

    const groups = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([genre, games]) => ({ genre, games }));
    if (noCollection.length > 0) groups.push({ genre: "Без коллекции", games: noCollection });
    return groups;
  }, [filtered, selectedGenre, search]);

  async function handleLogout() {
    if (token) await logout(serverUrl, token);
    await clearAuth();
    queryClient.clear();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(222,47%,11%)]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-[hsl(216,34%,20%)] bg-[hsl(222,47%,11%)]/90 px-6 py-3 backdrop-blur">
        <h1 className="text-xl font-bold text-white">LANCRAFT</h1>
        <div className="flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск игр…"
            className={clsx(
              "w-full max-w-sm rounded-lg border",
              "border-[hsl(216,34%,30%)] bg-[hsl(216,34%,20%)]",
              "px-3 py-1.5 text-sm text-white placeholder-slate-500",
              "focus:border-blue-500 focus:outline-none",
            )}
          />
        </div>
        {/* Collection dropdown */}
        <div ref={genreDropdownRef} className="relative">
          <button
            onClick={() => setGenreDropdownOpen((v) => !v)}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              selectedGenre
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-[hsl(216,34%,30%)] text-slate-400 hover:text-white",
            )}
          >
            {selectedGenre === NO_COLLECTION ? "Без коллекции" : (selectedGenre ?? "Коллекция")}
            <span className="text-xs opacity-70">▾</span>
          </button>
          {genreDropdownOpen && (
            <div className="absolute top-full right-0 z-20 mt-1 max-h-72 w-48 overflow-hidden overflow-y-auto rounded-lg border border-[hsl(216,34%,28%)] bg-[hsl(222,47%,18%)] shadow-xl">
              <button
                onClick={() => {
                  setSelectedGenre(null);
                  setGenreDropdownOpen(false);
                }}
                className={clsx(
                  "w-full px-4 py-2 text-left text-sm transition-colors",
                  !selectedGenre ? "text-blue-400" : "text-slate-300 hover:bg-[hsl(216,34%,25%)]",
                )}
              >
                Все коллекции
              </button>
              {allCollections.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setSelectedGenre(c);
                    setGenreDropdownOpen(false);
                  }}
                  className={clsx(
                    "w-full px-4 py-2 text-left text-sm transition-colors",
                    selectedGenre === c ? "text-blue-400" : "text-slate-300 hover:bg-[hsl(216,34%,25%)]",
                  )}
                >
                  {c}
                </button>
              ))}
              <div className="mt-1 border-t border-[hsl(216,34%,25%)] pt-1">
                <button
                  onClick={() => {
                    setSelectedGenre(NO_COLLECTION);
                    setGenreDropdownOpen(false);
                  }}
                  className={clsx(
                    "w-full px-4 py-2 text-left text-sm transition-colors",
                    selectedGenre === NO_COLLECTION ? "text-blue-400" : "text-slate-400 hover:bg-[hsl(216,34%,25%)]",
                  )}
                >
                  Без коллекции
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setFilterInstalled((v) => !v)}
          className={clsx(
            "rounded-lg border px-3 py-1.5 text-sm transition-colors",
            filterInstalled
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-[hsl(216,34%,30%)] text-slate-400 hover:text-white",
          )}
        >
          Установленные
        </button>
        {/* User dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-400 transition-colors hover:bg-[hsl(216,34%,20%)] hover:text-white"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(216,34%,25%)] text-xs font-medium text-white">
              {profile ? (profile.alias ?? profile.userName).slice(0, 1).toUpperCase() : "?"}
            </div>
            <span className="max-w-[100px] truncate text-sm">
              {profile ? (profile.alias ?? profile.userName) : "…"}
            </span>
            <span className="text-xs opacity-50">▾</span>
          </button>
          {userMenuOpen && (
            <div className="absolute top-full right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-[hsl(216,34%,28%)] bg-[hsl(222,47%,18%)] shadow-xl">
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate("/settings");
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-[hsl(216,34%,25%)]"
              >
                <span>⚙</span> Настройки
              </button>
              <div className="border-t border-[hsl(216,34%,25%)]" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-[hsl(216,34%,25%)]"
              >
                <span>→</span> Выйти
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6">
        {isLoading && <div className="flex h-64 items-center justify-center text-slate-400">Загрузка библиотеки…</div>}

        {error && (
          <div className="flex h-64 items-center justify-center text-red-400">
            Ошибка загрузки: {error instanceof Error ? error.message : "Неизвестная ошибка"}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex h-64 items-center justify-center text-slate-400">
            {search ? "Игры не найдены" : "Библиотека пуста"}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <>
            <p className="mb-4 text-sm text-slate-500">
              {filtered.length} игр{filtered.length === 1 ? "а" : ""}
              {selectedGenre && (
                <span>
                  {" "}
                  ·{" "}
                  <button onClick={() => setSelectedGenre(null)} className="text-blue-400 hover:text-blue-300">
                    {selectedGenre} ✕
                  </button>
                </span>
              )}
            </p>

            {groupedByGenre.length > 0 ? (
              <div className="space-y-8">
                {groupedByGenre.map(({ genre, games: sectionGames }) => (
                  <section key={genre}>
                    <button
                      onClick={() => setSelectedGenre(genre === "Без коллекции" ? null : genre)}
                      className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white"
                    >
                      {genre}
                      <span className="text-xs text-slate-600">{sectionGames.length}</span>
                    </button>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                      {sectionGames.map((game) => (
                        <GameCard key={game.id} game={game} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                {filtered.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
