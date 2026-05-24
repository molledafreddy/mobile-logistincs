import { act } from '@testing-library/react-native';

const mockUser = {
  id: 'u1',
  email: 'driver@test.com',
  firstName: 'Juan',
  lastName: 'Perez',
  fullName: 'Juan Perez',
  phone: null,
  avatarUrl: null,
  role: 'driver' as const,
  status: 'active' as const,
  companyId: 'c1',
  timezone: 'America/New_York',
  language: 'en',
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

jest.mock('../services/api/auth.service', () => ({
  AuthService: {
    login: jest.fn(),
    logout: jest.fn(),
    getMe: jest.fn(),
    deregisterDeviceToken: jest.fn(),
  },
}));

jest.mock('../services/storage/storage.service', () => ({
  StorageService: {
    saveTokens: jest.fn(),
    saveUser: jest.fn(),
    getAccessToken: jest.fn(),
    clearTokens: jest.fn(),
    clearUser: jest.fn(),
    saveDriverId: jest.fn(),
    getDriverId: jest.fn(),
    clearDriverId: jest.fn(),
    getPushToken: jest.fn(),
    clearPushToken: jest.fn(),
    clearSetupCompleted: jest.fn(),
  },
}));

jest.mock('../services/socket/socket.service', () => ({
  SocketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('../services/location/location.service', () => ({
  LocationService: {
    stopTracking: jest.fn(),
  },
}));

jest.mock('../services/api/drivers.service', () => ({
  DriversService: {
    getAll: jest.fn(),
  },
}));

import { useAuthStore } from './auth.store';
import { AuthService } from '../services/api/auth.service';
import { StorageService } from '../services/storage/storage.service';
import { SocketService } from '../services/socket/socket.service';
import { LocationService } from '../services/location/location.service';
import { DriversService } from '../services/api/drivers.service';

beforeEach(() => {
  useAuthStore.setState({ user: null, driverId: null, isAuthenticated: false, isLoading: true });
  jest.clearAllMocks();
});

describe('auth.store', () => {
  describe('login', () => {
    it('sets user and isAuthenticated on success', async () => {
      (AuthService.login as jest.Mock).mockResolvedValue({
        user: mockUser,
        session: { accessToken: 'access-token', refreshToken: 'refresh-token', expiresAt: 9999999999 },
      });
      (SocketService.connect as jest.Mock).mockResolvedValue(undefined);
      (StorageService.saveTokens as jest.Mock).mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().login('driver@test.com', 'password');
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('saves tokens to storage', async () => {
      (AuthService.login as jest.Mock).mockResolvedValue({
        user: mockUser,
        session: { accessToken: 'access-token', refreshToken: 'refresh-token', expiresAt: 9999999999 },
      });
      (SocketService.connect as jest.Mock).mockResolvedValue(undefined);
      (StorageService.saveTokens as jest.Mock).mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().login('driver@test.com', 'password');
      });

      expect(StorageService.saveTokens).toHaveBeenCalledWith('access-token', 'refresh-token');

    });
  });

  describe('logout', () => {
    it('clears user and isAuthenticated', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });
      (AuthService.logout as jest.Mock).mockResolvedValue(undefined);
      (LocationService.stopTracking as jest.Mock).mockResolvedValue(undefined);
      (StorageService.clearTokens as jest.Mock).mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('clears state even when API logout fails', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });
      (AuthService.logout as jest.Mock).mockRejectedValue(new Error('network'));
      (LocationService.stopTracking as jest.Mock).mockResolvedValue(undefined);
      (StorageService.clearTokens as jest.Mock).mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('hydrateFromStorage', () => {
    it('sets isLoading false when no token found', async () => {
      (StorageService.getAccessToken as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        await useAuthStore.getState().hydrateFromStorage();
      });

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });

    it('sets user and isAuthenticated when token is valid', async () => {
      (StorageService.getAccessToken as jest.Mock).mockResolvedValue('valid-token');
      (StorageService.getDriverId as jest.Mock).mockReturnValue('d1');
      (AuthService.getMe as jest.Mock).mockResolvedValue(mockUser);
      (SocketService.connect as jest.Mock).mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().hydrateFromStorage();
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.driverId).toBe('d1');
    });

    it('looks up driverId from API when not cached (driver role)', async () => {
      const driverUser = { ...mockUser, role: 'driver' as const };
      (StorageService.getAccessToken as jest.Mock).mockResolvedValue('valid-token');
      (StorageService.getDriverId as jest.Mock).mockReturnValue(null);
      (AuthService.getMe as jest.Mock).mockResolvedValue(driverUser);
      (SocketService.connect as jest.Mock).mockResolvedValue(undefined);
      (DriversService.getAll as jest.Mock).mockResolvedValue({
        data: [{ id: 'driver-api-1', userId: driverUser.id }],
        total: 1, page: 1, limit: 10,
      });

      await act(async () => {
        await useAuthStore.getState().hydrateFromStorage();
      });

      expect(StorageService.saveDriverId).toHaveBeenCalledWith('driver-api-1');
      expect(useAuthStore.getState().driverId).toBe('driver-api-1');
    });

    it('clears state and sets isLoading false when token is invalid', async () => {
      (StorageService.getAccessToken as jest.Mock).mockResolvedValue('expired-token');
      (AuthService.getMe as jest.Mock).mockRejectedValue(new Error('401'));
      (StorageService.clearTokens as jest.Mock).mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().hydrateFromStorage();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.driverId).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });
});
