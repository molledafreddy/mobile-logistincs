import { apiClient } from './client';
import type { AuthTokens, AuthUser, Company } from '../../types';

// ─── Payloads ─────────────────────────────────────────────────────────────────

interface LoginPayload {
  email: string;
  password: string;
}

interface ActivatePayload {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

interface AcceptInviteResponse {
  user: AuthUser;
  message: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName: string;
  companyType: 'carrier' | 'broker' | 'shipper';
  phone?: string;
}

// ─── Responses ────────────────────────────────────────────────────────────────

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/** Shape returned by /auth/login and /auth/activate */
export interface AuthResponse {
  user: AuthUser;
  session: AuthSession;
}

export interface RegisterResponse {
  user: AuthUser;
  company: Pick<Company, 'id' | 'name' | 'type' | 'status' | 'taxId' | 'email' | 'phone' | 'createdAt'>;
  session: AuthSession | null;
  message?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const AuthService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  async activate(payload: ActivatePayload): Promise<AcceptInviteResponse> {
    const { data } = await apiClient.post<AcceptInviteResponse>('/users/accept-invite', {
      token: payload.token,
      firstName: payload.firstName,
      lastName: payload.lastName,
      password: payload.password,
    });
    return data;
  },

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const { data } = await apiClient.post<AuthTokens>('/auth/refresh', { refreshToken });
    return data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async getMe(): Promise<AuthUser> {
    const { data } = await apiClient.get<AuthUser>('/auth/profile');
    return data;
  },

  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    const { data } = await apiClient.post<RegisterResponse>('/auth/register', payload);
    return data;
  },

  async registerDeviceToken(token: string, platform: 'ios' | 'android'): Promise<void> {
    await apiClient.post('/notifications/push-tokens', { token, platform });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.patch('/auth/change-password', { currentPassword, newPassword });
  },

  async deregisterDeviceToken(token: string): Promise<void> {
    await apiClient.delete(`/notifications/push-tokens/${encodeURIComponent(token)}`);
  },

  async getMyPermissions(): Promise<{ permissions: string[] }> {
    const { data } = await apiClient.get<{ permissions: string[] }>('/auth/me/permissions');
    return data;
  },
};
