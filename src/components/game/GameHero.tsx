import { memo } from "react";
import { mediaUrl } from "@/api/client";
import type { Media } from "@/api/types";

interface Props {
  heroMedia?: Media;
}

const GameHero = memo(function GameHero({ heroMedia }: Props) {
  return (
    <div className="relative h-80 overflow-hidden">
      {heroMedia ? (
        <img src={mediaUrl(heroMedia.id, heroMedia.fileId)} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-slate-800" />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-[hsl(222,47%,11%)] via-[hsl(222,47%,11%)]/40 to-transparent" />
    </div>
  );
});

export default GameHero;
