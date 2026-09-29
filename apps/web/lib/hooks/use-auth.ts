'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { authApi, isOtpRequired } from '@/lib/api/auth';
import { bindTokenProvider } from '@/lib/api-client';
import { persistTokenMirror, useAuthStore, type AuthUser } from '@/lib/stores/auth-store';

/**
 * Auth orchestration hook (7.3.6 guards + 7.1.9 wiring).
 * - Binds the Zustand store into the Axios client (single-flight refresh)
 * - Exposes login / logout / register helpers used by auth pages
 */
export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, refreshToken, user, hydrated, setTokens, setUser, clear } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wire the store into the Axios interceptor once
  useEffect(() => {
    bindTokenProvider({
      getAccessToken: () => useAuthStore.getState().accessToken,
      getRefreshToken: () => useAuthStore.getState().refreshToken,
      onTokensRefreshed: (access, refresh) => {
        useAuthStore.getState().setTokens({ accessToken: access, refreshToken: refresh });
        persistTokenMirror(access);
      },
      onAuthFailure: () => {
        useAuthStore.getState().clear();
        persistTokenMirror(null);
      },
    });
  }, []);

  // Keep the interceptor's localStorage mirror in sync
  useEffect(() => {
    persistTokenMirror(accessToken);
  }, [accessToken]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const result = await authApi.login({ identifier, password });
        if (isOtpRequired(result)) {
          return { requiresOtp: true as const, userId: result.userId, phone: identifier };
        }
        setTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        });
        setUser(result.user as AuthUser);
        persistTokenMirror(result.accessToken);
        return { requiresOtp: false as const };
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ورود ناموفق بود');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [setTokens, setUser],
  );

  const register = useCallback(
    async (data: { phone: string; password: string; fullName?: string; email?: string }) => {
      setSubmitting(true);
      setError(null);
      try {
        return await authApi.register(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ثبت‌نام ناموفق بود');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => undefined);
      }
    } finally {
      clear();
      persistTokenMirror(null);
      queryClient.clear();
      router.replace('/login');
    }
  }, [refreshToken, clear, queryClient, router]);

  return { user, hydrated, accessToken, submitting, error, login, register, logout, setError };
}
