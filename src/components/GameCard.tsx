import { useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";

import { thumbnailUrl } from "../api/client";
import { MediaType } from "../api/types";
import type { Game } from "../api/types";
import { useGame } from "../hooks/useGames";
import { useGameStateStore } from "../stores/gameStateStore";
import { useSettingsStore } from "../stores/settingsStore";

interface Props {
  game: Game;
}

export default function GameCard({ game }: Props) {
  const navigate = useNavigate();
  const { getGameInstalled } = useSettingsStore();
  const { downloadingGames } = useGameStateStore();
  const [imgError, setImgError] = useState(false);

  const needsMedia = !game.media || game.media.length === 0;
  const { data: fullGame } = useGame(needsMedia ? game.id : "");
  const mediaSource = needsMedia ? fullGame : game;
  const cover = (mediaSource?.media ?? []).find(
    (m) => m.type === MediaType.Cover,
  );
  const installed = getGameInstalled(game.id);
  const downloading = downloadingGames.has(game.id);

  return (
    <button
      onClick={() => navigate(`/game/${game.id}`)}
      title={game.title}
      className={clsx(
        'group relative rounded-lg overflow-hidden',
        'bg-slate-800',
        'hover:ring-2 hover:ring-blue-500',
        'transition-all cursor-pointer text-left'
      )}
    >
      <div className="aspect-[2/3] relative bg-slate-700">
        {cover && !imgError ? (
          <img
            src={thumbnailUrl(cover.id)}
            alt={game.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-slate-500 text-4xl">🎮</span>
          </div>
        )}
        {installed?.installed && (
          <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-400 rounded-full" />
        )}
        {downloading && (
          <div className="absolute top-2 left-2 w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse" />
        )}
      </div>

      <div className="p-2">
        <p className="text-sm font-medium text-white truncate">{game.title}</p>
        {(game.genres ?? []).length > 0 && (
          <p className="text-xs text-slate-400 truncate">
            {(game.genres ?? []).map((g) => g.name).join(", ")}
          </p>
        )}
      </div>
    </button>
  );
}
