import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { StorageService } from '../storage/storage.service';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await StorageService.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Transparent token refresh on 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

// Unwrap { success, data, timestamp } envelope added by the API's ResponseTransformInterceptor
apiClient.interceptors.response.use(
  (response) => {
    if (
      response.data !== null &&
      typeof response.data === 'object' &&
      'success' in response.data &&
      'data' in response.data
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await StorageService.getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');

      const { data: refreshData } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const envelope = refreshData?.data ?? refreshData;
      const { accessToken, refreshToken: newRefreshToken } = envelope;

      await StorageService.saveTokens(accessToken, newRefreshToken);

      refreshQueue.forEach((cb) => cb(accessToken));
      refreshQueue = [];

      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch {
      refreshQueue = [];
      await StorageService.clearTokens();
      StorageService.clearUser();
      // Signal auth store to log out
      authEventEmitter.emit('logout');
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

// Minimal event emitter to decouple from Zustand (avoids circular deps)
type Listener = () => void;
export const authEventEmitter = {
  listeners: new Set<Listener>(),
  on(_event: 'logout', fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  },
  emit(_event: 'logout') {
    this.listeners.forEach((fn) => fn());
  },
};
