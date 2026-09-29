import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@caffenet/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ==================== Token plumbing (7.1.9) ====================
// The auth store is the source of truth; we mirror the access token into
// localStorage so the interceptor can read it synchronously.

let getAccessToken: () => string | null = () =>
  typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
let getRefreshToken: () => string | null = () => null;
let onTokensRefreshed: ((accessToken: string, refreshToken: string) => void) | null = null;
let onAuthFailure: (() => void) | null = null;

/** Called once by AuthProvider to wire the store into the client. */
export function bindTokenProvider(ops: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokensRefreshed: (accessToken: string, refreshToken: string) => void;
  onAuthFailure: () => void;
}) {
  getAccessToken = ops.getAccessToken;
  getRefreshToken = ops.getRefreshToken;
  onTokensRefreshed = ops.onTokensRefreshed;
  onAuthFailure = ops.onAuthFailure;
}

// ==================== Request interceptor — attach bearer ====================
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==================== Refresh queue — single flight ====================
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new ApiError('NO_REFRESH', 'نشست منقضی شده است', 401);

  const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
    `${API_URL}/auth/refresh`,
    { refreshToken },
    { timeout: 15_000 },
  );
  const payload = res.data;
  if (!payload || payload.success === false || !payload.data) {
    throw new ApiError('REFRESH_FAILED', 'تمدید نشست ناموفق بود', 401);
  }
  const { accessToken, refreshToken: newRefresh } = payload.data;
  onTokensRefreshed?.(accessToken, newRefresh ?? refreshToken);
  return accessToken;
}

async function tryRefresh(config: InternalAxiosRequestConfig): Promise<unknown> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  const newToken = await refreshPromise;
  config.headers.Authorization = `Bearer ${newToken}`;
  // Retry the original request exactly once with the fresh token
  const retry = await apiClient.request(config);
  return retry;
}

// ==================== Response interceptor — unwrap + errors ====================
apiClient.interceptors.response.use(
  (response) => {
    // Blob responses (PDF download) pass through untouched
    if (response.config.responseType === 'blob') return response;

    const data = response.data as ApiResponse;
    if (data && data.success === false && data.error) {
      return Promise.reject(
        new ApiError(data.error.code, data.error.message, response.status, data.error.details),
      );
    }
    // Unwrap success envelope — return just `data`
    return { ...response, data: data.data ?? response.data };
  },
  async (error: AxiosError<ApiResponse>) => {
    const config = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    // 401 → single refresh + retry (except the refresh call itself)
    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !config.url?.includes('/auth/refresh') &&
      !config.url?.includes('/auth/login') &&
      !config.url?.includes('/auth/register')
    ) {
      config._retried = true;
      try {
        return await tryRefresh(config);
      } catch {
        onAuthFailure?.();
        return Promise.reject(new ApiError('UNAUTHORIZED', 'لطفاً دوباره وارد شوید', 401));
      }
    }

    if (error.response?.data?.error) {
      const { code, message, details } = error.response.data.error;
      return Promise.reject(new ApiError(code, message, error.response.status, details));
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('TIMEOUT', 'زمان درخواست به پایان رسید', 0));
    }
    if (!error.response) {
      return Promise.reject(
        new ApiError('NETWORK_ERROR', 'خطای شبکه — اتصال اینترنت را بررسی کنید', 0),
      );
    }
    return Promise.reject(new ApiError('UNKNOWN', 'خطای ناشناخته', error.response.status));
  },
);
