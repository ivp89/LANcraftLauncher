import { useState } from "react";
import clsx from "clsx";
import { invoke } from "@tauri-apps/api/core";

interface ServerInfo {
  address: string;
  name: string;
  version: string;
}

interface Props {
  onSelect: (url: string) => void;
  currentUrl: string;
}

export default function ServerDiscovery({ onSelect, currentUrl }: Props) {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [manualUrl, setManualUrl] = useState(currentUrl);

  async function scan() {
    setScanning(true);
    setServers([]);
    try {
      const found = await invoke<ServerInfo[]>("discover_servers");
      setServers(found);
    } catch (e) {
      console.error("Discovery failed:", e);
    } finally {
      setScanning(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualUrl.trim()) onSelect(manualUrl.trim());
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={scan}
          disabled={scanning}
          className={clsx(
            'px-3 py-1.5 text-sm rounded',
            'bg-blue-600 hover:bg-blue-500',
            'disabled:opacity-50',
            'text-white'
          )}
        >
          {scanning ? "Сканирование…" : "Найти сервер"}
        </button>
      </div>

      {servers.length > 0 && (
        <div className="space-y-1">
          {servers.map((s) => (
            <button
              key={s.address}
              type="button"
              onClick={() => {
                setManualUrl(s.address);
                onSelect(s.address);
              }}
              className={clsx(
                'w-full text-left px-3 py-2 rounded',
                'bg-slate-700 hover:bg-slate-600',
                'text-sm'
              )}
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-slate-400 ml-2">{s.address}</span>
              {s.version && (
                <span className="text-slate-500 text-xs ml-2">
                  v{s.version}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {servers.length === 0 && !scanning && (
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="http://192.168.1.100:1337"
            className={clsx(
              'flex-1 px-3 py-1.5 text-sm rounded',
              'bg-slate-700 border border-slate-600',
              'text-white placeholder-slate-500',
              'focus:outline-none focus:border-blue-500'
            )}
          />
          <button
            type="submit"
            className={clsx(
              'px-3 py-1.5 text-sm rounded',
              'bg-slate-600 hover:bg-slate-500',
              'text-white'
            )}
          >
            OK
          </button>
        </form>
      )}
    </div>
  );
}
