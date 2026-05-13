import { memo } from "react";

import DownloadProgress from "@/components/DownloadProgress";

interface Props {
  gameId: string;
  installing: boolean;
  installSuccess: boolean;
  onCancel: () => void;
}

const GameInstallProgress = memo(function GameInstallProgress({ gameId, installing, installSuccess, onCancel }: Props) {
  if (!installing && !installSuccess) return null;
  return (
    <>
      {installing && (
        <div className="mb-4 space-y-2">
          <DownloadProgress gameId={gameId} />
          <button onClick={onCancel} className="text-sm text-slate-400 transition-colors hover:text-red-400">
            Отменить
          </button>
        </div>
      )}
      {installSuccess && !installing && <p className="mb-4 text-sm text-green-400">✓ Установлено</p>}
    </>
  );
});

export default GameInstallProgress;
