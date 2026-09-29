'use client';

import { apiClient } from '@/lib/api-client';

/**
 * Auth API (7.3) — mirrors apps/api/src/modules/auth.
 * Response envelope is unwrapped by the interceptor (data = payload.data).
 */

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    uuid: string;
    phone: string;
    email: string | null;
    fullName: string | null;
    roles: string[];
    permissions: string[];
    status: string;
  };
}

export interface RegisterResult {
  userId: string;
  otpId: string;
  expiresAt: string;
}

export interface OtpRequiredResult {
  requiresOtp: true;
  userId: string;
  otpId: string;
  expiresAt: string;
}

export type LoginResult = AuthTokensResponse | OtpRequiredResult;

export function isOtpRequired(result: LoginResult): result is OtpRequiredResult {
  return (result as OtpRequiredResult).requiresOtp === true;
}

export const authApi = {
  register: (data: { phone: string; password: string; email?: string; fullName?: string }) =>
    apiClient.post<RegisterResult>('/auth/register', data).then((r) => r.data),

  login: (data: { identifier: string; password: string }) =>
    apiClient.post<LoginResult>('/auth/login', data).then((r) => r.data),

  verifyOtp: (data: {
    phone: string;
    code: string;
    type: 'register' | 'login' | 'forgot_password' | 'reset_password';
  }) => apiClient.post<AuthTokensResponse>('/auth/verify-otp', data).then((r) => r.data),

  resendOtp: (data: { phone: string; type: string }) =>
    apiClient
      .post<{ otpId: string; expiresAt: string }>('/auth/resend-otp', data)
      .then((r) => r.data),

  forgotPassword: (data: { identifier: string }) =>
    apiClient
      .post<{ otpId?: string; expiresAt?: string }>('/auth/forgot-password', data)
      .then((r) => r.data),

  resetPassword: (data: { phone: string; code: string; newPassword: string }) =>
    apiClient.post<{ success: boolean }>('/auth/reset-password', data).then((r) => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.post<{ success: boolean }>('/auth/change-password', data).then((r) => r.data),

  me: () => apiClient.get<AuthTokensResponse['user']>('/auth/me').then((r) => r.data),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken }).then((r) => r.data),

  refresh: (refreshToken: string) =>
    apiClient.post<AuthTokensResponse>('/auth/refresh', { refreshToken }).then((r) => r.data),

  // Sessions (7.9.4)
  listSessions: () =>
    apiClient.get<{ sessions: SessionDto[] }>('/auth/sessions').then((r) => r.data),

  revokeSession: (id: string) =>
    apiClient.delete<{ message: string }>(`/auth/sessions/${id}`).then((r) => r.data),

  revokeAllSessions: (refreshToken: string) =>
    apiClient
      .delete<{ message: string; revokedCount: number }>('/auth/sessions', {
        data: { refreshToken },
      })
      .then((r) => r.data),
};

export interface SessionDto {
  id: string;
  uuid: string;
  userAgent?: string | null;
  ip?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  expiresAt: string;
}
