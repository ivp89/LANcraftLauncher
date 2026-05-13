import { memo } from "react";
import clsx from "clsx";

interface Props {
  saveSyncing: boolean;
  onDownload: () => void;
  onUpload: () => void;
  disabled?: boolean;
}

const GameSaveButtons = memo(function GameSaveButtons({ saveSyncing, onDownload, onUpload, disabled }: Props) {
  return (
    <div className="flex gap-1">
      <button
        onClick={onDownload}
        disabled={saveSyncing || disabled}
        className={clsx(
          "rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300",
          "transition-colors hover:bg-slate-600",
          "disabled:opacity-50",
        )}
        title="Загрузить сохранение с сервера"
      >
        {saveSyncing ? "…" : "↓ Сейв"}
      </button>
      <button
        onClick={onUpload}
        disabled={saveSyncing || disabled}
        className={clsx(
          "rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300",
          "transition-colors hover:bg-slate-600",
          "disabled:opacity-50",
        )}
        title="Загрузить сохранение на сервер"
      >
        {saveSyncing ? "…" : "↑ Сейв"}
      </button>
    </div>
  );
});

export default GameSaveButtons;
