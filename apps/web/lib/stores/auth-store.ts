'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mirrorTokenToIdb } from '@/lib/pwa/idb';

/**
 * Auth store (7.1.7).
 * Persists tokens + a light user snapshot; the authoritative user object
 * is re-fetched from GET /auth/me on app start (see useAuth hook).
 */

export interface AuthUser {
  id: string;
  uuid: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
  permissions: string[];
  status: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** Hydrated from localStorage — used by guards to avoid redirect flicker */
  hydrated: boolean;

  setTokens: (tokens: { accessToken: string; refreshToken: string; expiresIn?: number }) => void;
  setUser: (user: AuthUser | null) => void;
  setHydrated: (hydrated: boolean) => void;
  /** Clear auth state (logout / refresh failure) */
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hydrated: false,

      setTokens: ({ accessToken, refreshToken }) =>
        set((state) => ({
          accessToken,
          refreshToken,
          user: state.user,
        })),

      setUser: (user) => set({ user }),

      setHydrated: (hydrated) => set({ hydrated }),

      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'caffenet-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

// Mirror the access token to localStorage for the Axios interceptor
// (api-client reads `access_token` on every request) AND into IndexedDB so
// the service worker can use it for Background Sync (12.2.7) — localStorage
// is NOT accessible from the SW context.
export function persistTokenMirror(accessToken: string | null) {
  if (typeof window === 'undefined') return;
  if (accessToken) {
    window.localStorage.setItem('access_token', accessToken);
  } else {
    window.localStorage.removeItem('access_token');
  }
  void mirrorTokenToIdb(accessToken);
}
