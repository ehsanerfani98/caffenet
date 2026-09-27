import axios, { AxiosError, AxiosInstance } from 'axios';
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

// Request interceptor — attach auth token + idempotency
apiClient.interceptors.request.use((config) => {
  // Attach access token from memory/localStorage
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — unwrap envelope, handle errors
apiClient.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse;
    if (data && data.success === false && data.error) {
      return Promise.reject(new ApiError(data.error.code, data.error.message, response.status, data.error.details));
    }
    // Unwrap success envelope — return just `data`
    return { ...response, data: data.data ?? response.data };
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.data?.error) {
      const { code, message, details } = error.response.data.error;
      return Promise.reject(new ApiError(code, message, error.response.status, details));
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('TIMEOUT', 'زمان درخواست به پایان رسید', 0));
    }
    if (!error.response) {
      return Promise.reject(new ApiError('NETWORK_ERROR', 'خطای شبکه — اتصال اینترنت را بررسی کنید', 0));
    }
    return Promise.reject(new ApiError('UNKNOWN', 'خطای ناشناخته', error.response.status));
  },
);

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
