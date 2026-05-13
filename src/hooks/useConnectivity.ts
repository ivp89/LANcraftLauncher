import { useEffect } from "react";

import { useConnectivityStore } from "@/stores/connectivityStore";

export function useConnectivity() {
  const checkConnectivity = useConnectivityStore((s) => s.checkConnectivity);

  useEffect(() => {
    checkConnectivity();
    const id = setInterval(checkConnectivity, 30_000);
    return () => clearInterval(id);
  }, [checkConnectivity]);
}
