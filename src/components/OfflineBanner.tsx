import { useConnectivityStore } from "@/stores/connectivityStore";

export default function OfflineBanner() {
  const isOnline = useConnectivityStore((s) => s.isOnline);
  if (isOnline) return null;
  return (
    <div className="sticky top-0 z-50 bg-amber-900/80 px-4 py-1.5 text-center text-sm text-amber-200 backdrop-blur">
      Офлайн — доступны только установленные игры
    </div>
  );
}
