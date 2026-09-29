'use client';

import { apiClient } from '@/lib/api-client';
import type { AuthUser } from '@/lib/stores/auth-store';

/**
 * Users API (7.9) — profile endpoints.
 */

export interface UserProfile extends AuthUser {
  avatar?: string | null;
  preferredContactMethodId?: string | null;
  createdAt?: string;
}

export const usersApi = {
  me: () => apiClient.get<UserProfile>('/users/me').then((r) => r.data),

  updateMe: (data: { fullName?: string; email?: string }) =>
    apiClient.patch<UserProfile>('/users/me', data).then((r) => r.data),
};
