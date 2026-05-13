import { memo } from "react";
import type { Game } from "@/api/types";

interface Props {
  game: Game;
}

const GameMeta = memo(function GameMeta({ game }: Props) {
  const publishers = game.publishers ?? [];
  const platforms = game.platforms ?? [];
  const version = (game.archives ?? [])[0]?.version;

  if (!game.releasedOn && publishers.length === 0 && platforms.length === 0 && !version) return null;

  return (
    <div className="mt-6 grid max-w-md grid-cols-2 gap-4 text-sm">
      {game.releasedOn && (
        <div>
          <span className="text-slate-500">Год выхода</span>
          <p className="text-white">{new Date(game.releasedOn).getFullYear()}</p>
        </div>
      )}
      {publishers.length > 0 && (
        <div>
          <span className="text-slate-500">Издатель</span>
          <p className="text-white">{publishers.map((p) => p.name).join(", ")}</p>
        </div>
      )}
      {platforms.length > 0 && (
        <div>
          <span className="text-slate-500">Платформы</span>
          <p className="text-white">{platforms.map((p) => p.name).join(", ")}</p>
        </div>
      )}
      {version && (
        <div>
          <span className="text-slate-500">Версия</span>
          <p className="text-white">{version}</p>
        </div>
      )}
    </div>
  );
});

export default GameMeta;
