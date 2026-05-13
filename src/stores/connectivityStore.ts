import { create } from "zustand";

import { validateToken } from "@/api/auth";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface ConnectivityState {
  isOnline: boolean;
  lastChecked: number | null;
  checkConnectivity: () => Promise<void>;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: true,
  lastChecked: null,

  checkConnectivity: async () => {
    const { serverUrl } = useSettingsStore.getState();
    const { token } = useAuthStore.getState();
    if (!serverUrl || !token) return;
    const ok = await validateToken(serverUrl, token);
    set({ isOnline: ok, lastChecked: Date.now() });
  },
}));
