import { memo } from "react";

import type { Game, Media } from "@/api/types";
import { useCachedMediaDownload, useCachedThumbnail } from "@/hooks/useCachedMedia";

interface Props {
  game: Game;
  cover?: Media;
  logo?: Media;
}

const GameHeaderInfo = memo(function GameHeaderInfo({ game, cover, logo }: Props) {
  const coverSrc = useCachedThumbnail(cover);
  const logoSrc = useCachedMediaDownload(logo);
  return (
    <>
      {cover && coverSrc && (
        <img src={coverSrc} alt={game.title} className="w-32 shrink-0 rounded-lg shadow-lg" />
      )}
      <div className="flex-1">
        {logo && logoSrc ? (
          <img src={logoSrc} alt={game.title} className="mb-2 max-h-20 max-w-xs object-contain" />
        ) : (
          <h1 className="text-3xl font-bold text-white">{game.title}</h1>
        )}
        {(game.developers ?? []).length > 0 && (
          <p className="mt-1 text-slate-400">{(game.developers ?? []).map((d) => d.name).join(", ")}</p>
        )}
        {(game.genres ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {(game.genres ?? []).map((g) => (
              <span key={g.id} className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
});

export default GameHeaderInfo;
