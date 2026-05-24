import { create } from 'zustand';
import { AuthService } from '../services/api/auth.service';
import { StorageService } from '../services/storage/storage.service';
import { SocketService } from '../services/socket/socket.service';
import { LocationService } from '../services/location/location.service';
import { DriversService } from '../services/api/drivers.service';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  driverId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  loginWithSession: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  setDriverId: (id: string | null) => void;
  logout: () => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  driverId: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { user, session } = await AuthService.login({ email, password });
    await StorageService.saveTokens(session.accessToken, session.refreshToken);
    StorageService.saveUser(user);
    try { await SocketService.connect(); } catch { /* reconnection handles retry */ }
    set({ user, isAuthenticated: true });
  },

  loginWithSession: async (user, accessToken, refreshToken) => {
    await StorageService.saveTokens(accessToken, refreshToken);
    StorageService.saveUser(user);
    try { await SocketService.connect(); } catch { /* reconnection handles retry */ }
    set({ user, isAuthenticated: true });
  },

  setDriverId: (id) => {
    if (id) StorageService.saveDriverId(id);
    else StorageService.clearDriverId();
    set({ driverId: id });
  },

  logout: async () => {
    const pushToken = StorageService.getPushToken();
    try {
      await Promise.all([
        AuthService.logout(),
        pushToken ? AuthService.deregisterDeviceToken(pushToken) : Promise.resolve(),
      ]);
    } catch {
      // Ignore API errors on logout
    } finally {
      await LocationService.stopTracking();
      SocketService.disconnect();
      await StorageService.clearTokens();
      StorageService.clearUser();
      StorageService.clearDriverId();
      StorageService.clearSetupCompleted();
      StorageService.clearPushToken();
      set({ user: null, driverId: null, isAuthenticated: false });
    }
  },

  hydrateFromStorage: async () => {
    const token = await StorageService.getAccessToken();
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const user = await AuthService.getMe();
      StorageService.saveUser(user);
      await SocketService.connect();

      // Resolve driverId: fast path from MMKV, fallback to API lookup for driver role
      let driverId: string | null = StorageService.getDriverId();
      if (!driverId && user.role === 'driver') {
        const { data } = await DriversService.getAll({ userId: user.id });
        const match = data.find((d) => d.userId === user.id);
        if (match) {
          driverId = match.id;
          StorageService.saveDriverId(match.id);
        }
      }

      set({ user, driverId, isAuthenticated: true, isLoading: false });
    } catch {
      await StorageService.clearTokens();
      StorageService.clearUser();
      StorageService.clearDriverId();
      set({ user: null, driverId: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
