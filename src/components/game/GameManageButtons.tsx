import { memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";

interface Props {
  installPath: string;
  uninstalling: boolean;
  onUninstall: () => void;
}

const GameManageButtons = memo(function GameManageButtons({ installPath, uninstalling, onUninstall }: Props) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => invoke("open_dir", { path: installPath })}
        className={clsx(
          "rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300",
          "transition-colors hover:bg-slate-600",
        )}
        title="Открыть папку с игрой"
      >
        📁
      </button>
      <button
        onClick={onUninstall}
        disabled={uninstalling}
        className={clsx(
          "rounded-lg border border-red-800 px-4 py-1.5 text-sm",
          "text-red-400 transition-colors hover:bg-red-900/30",
          "disabled:opacity-50",
        )}
      >
        {uninstalling ? "Удаление…" : "Удалить"}
      </button>
    </div>
  );
});

export default GameManageButtons;
