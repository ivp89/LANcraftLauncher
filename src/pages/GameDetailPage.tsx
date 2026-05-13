import { useParams, useNavigate } from "react-router-dom";

import { MediaType } from "@/api/types";
import GameActionsPanel from "@/components/game/GameActionsPanel";
import GameHeaderInfo from "@/components/game/GameHeaderInfo";
import GameHero from "@/components/game/GameHero";
import GameMeta from "@/components/game/GameMeta";
import { useGame } from "@/hooks/useGames";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: game, isLoading, error } = useGame(id!);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Загрузка…</div>;
  }

  if (error || !game) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-red-400">
        <p>Ошибка загрузки игры</p>
        <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white">
          ← Назад
        </button>
      </div>
    );
  }

  const media = game.media ?? [];
  const cover = media.find((m) => m.type === MediaType.Cover);
  const background = media.find((m) => m.type === MediaType.Background);
  const logo = media.find((m) => m.type === MediaType.Logo);
  const screenshots = media.filter((m) => m.type === MediaType.Screenshot);
  const heroMedia = background ?? screenshots[0] ?? cover;

  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)]">
      <GameHero heroMedia={heroMedia} />

      <div className="relative -mt-24 px-6 pb-12">
        <div className="mb-6 flex items-end gap-6">
          <button onClick={() => navigate(-1)} className="mb-1 text-sm text-slate-400 hover:text-white">
            ← Назад
          </button>
          <GameHeaderInfo game={game} cover={cover} logo={logo} />
          <GameActionsPanel gameId={id!} />
        </div>

        {game.description && (
          <div className="max-w-2xl">
            <h2 className="mb-2 text-lg font-semibold text-white">Описание</h2>
            <p className="leading-relaxed whitespace-pre-wrap text-slate-300">{game.description}</p>
          </div>
        )}

        <GameMeta game={game} />
      </div>
    </div>
  );
}
