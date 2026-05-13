import { memo, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import type { GameAction } from "@/api/types";

interface Props {
  gameId: string;
  actions: GameAction[];
  primaryAction: GameAction;
  running: boolean;
  launching: boolean;
  onLaunch: (action: GameAction) => void;
}

const GameLaunchButton = memo(function GameLaunchButton({
  gameId,
  actions,
  primaryAction,
  running,
  launching,
  onLaunch,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showMenu]);

  if (running) {
    return (
      <button
        onClick={() => invoke("stop_game", { gameId }).catch(() => {})}
        className={clsx(
          "rounded-lg bg-red-600 px-6 py-2 font-semibold text-white",
          "transition-colors hover:bg-red-500",
        )}
      >
        ⏹ Стоп
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <div className="flex">
        <button
          onClick={() => onLaunch(primaryAction)}
          disabled={launching}
          className={clsx(
            "bg-green-600 px-6 py-2 font-semibold text-white",
            "transition-colors hover:bg-green-500",
            "disabled:opacity-50",
            actions.length > 1 ? "rounded-l-lg" : "rounded-lg",
          )}
        >
          {launching ? "Запуск…" : "▶ Играть"}
        </button>
        {actions.length > 1 && (
          <button
            onClick={() => setShowMenu((v) => !v)}
            disabled={launching}
            className={clsx(
              "rounded-r-lg border-l border-green-800 bg-green-700 px-2 py-2 text-white",
              "transition-colors hover:bg-green-600",
              "disabled:opacity-50",
            )}
            title="Другие действия"
          >
            ▾
          </button>
        )}
      </div>
      {showMenu && (
        <div
          className={clsx(
            "absolute top-full right-0 z-20 mt-1",
            "min-w-[160px] overflow-hidden rounded-lg",
            "border border-[hsl(216,34%,28%)]",
            "bg-[hsl(222,47%,18%)] shadow-xl",
          )}
        >
          {actions
            .filter((a) => a !== primaryAction)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((action) => (
              <button
                key={action.id}
                onClick={() => {
                  setShowMenu(false);
                  onLaunch(action);
                }}
                disabled={launching}
                className={clsx(
                  "w-full px-4 py-2 text-left text-sm text-white",
                  "transition-colors hover:bg-[hsl(216,34%,25%)]",
                  "disabled:opacity-50",
                )}
              >
                {action.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
});

export default GameLaunchButton;
