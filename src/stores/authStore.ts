import { LazyStore } from "@tauri-apps/plugin-store";
import { create } from "zustand";

import type { AuthToken } from "../api/auth";

const store = new LazyStore("auth.json");

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  expiration: string | null;
  isLoading: boolean;
  setAuth: (token: AuthToken) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStore: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  expiration: null,
  isLoading: true,

  setAuth: async (authToken: AuthToken) => {
    await store.set("token", authToken);
    await store.save();
    set({
      token: authToken.accessToken,
      refreshToken: authToken.refreshToken,
      expiration: authToken.expiration,
    });
  },

  clearAuth: async () => {
    await store.delete("token");
    await store.save();
    set({ token: null, refreshToken: null, expiration: null });
  },

  loadFromStore: async () => {
    try {
      const saved = await store.get<AuthToken>("token");
      if (saved) {
        set({
          token: saved.accessToken,
          refreshToken: saved.refreshToken,
          expiration: saved.expiration,
          isLoading: false,
        });
        return;
      }
    } catch {}
    set({ isLoading: false });
  },
}));
