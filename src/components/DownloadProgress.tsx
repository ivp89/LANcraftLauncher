import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

interface DownloadEvent {
  game_id: string;
  downloaded: number;
  total: number;
  speed: number;
}

interface ExtractEvent {
  game_id: string;
  extracted: number;
  total: number;
}

type Phase = "download" | "extract";

interface Props {
  gameId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function DownloadProgress({ gameId }: Props) {
  const [phase, setPhase] = useState<Phase>("download");
  const [percent, setPercent] = useState(0);
  const [label, setLabel] = useState("");
  const [speed, setSpeed] = useState(0);

  useEffect(() => {

    const unlistenDownload = listen<DownloadEvent>(
      "download-progress",
      (event) => {
        if (event.payload.game_id !== gameId) return;
        const { downloaded, total, speed: s } = event.payload;
        const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        setPhase("download");
        setPercent(pct);
        setSpeed(s);
        setLabel(`${formatBytes(downloaded)} / ${formatBytes(total)}`);
      },
    );

    const unlistenExtract = listen<ExtractEvent>(
      "extract-progress",
      (event) => {
        if (event.payload.game_id !== gameId) return;
        const { extracted, total } = event.payload;
        const pct = total > 0 ? Math.round((extracted / total) * 100) : 0;
        setPhase("extract");
        setPercent(pct);
        setSpeed(0);
        setLabel(`${extracted} / ${total} файлов`);
      },
    );

    return () => {
      unlistenDownload.then((fn) => fn());
      unlistenExtract.then((fn) => fn());
    };
  }, [gameId]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>
          {phase === "download" ? "Скачивание…" : "Распаковка…"}
          {phase === "download" && speed > 0 && (
            <span className="ml-2 text-slate-500">{formatBytes(speed)}/с</span>
          )}
        </span>
        <span>{label}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-200 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-xs text-slate-500 text-right">{percent}%</div>
    </div>
  );
}
