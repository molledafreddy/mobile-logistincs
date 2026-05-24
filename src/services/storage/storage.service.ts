import * as SecureStore from 'expo-secure-store';

// In-memory fallback compatible with Expo Go (no native MMKV required)
const _store = new Map<string, string>();
const mmkv = {
  set: (key: string, value: string) => _store.set(key, value),
  getString: (key: string) => _store.get(key),
  remove: (key: string) => _store.delete(key),
};

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user_data',
  DRIVER_ID: 'driver_id',
  SETUP_COMPLETED: 'setup_completed_v1',
  PUSH_TOKEN: 'push_token',
} as const;

// Tokens: SecureStore (iOS Keychain / Android Keystore)
export const StorageService = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
    ]);
  },

  // User data: MMKV (fast, non-sensitive)
  saveUser(user: object): void {
    mmkv.set(KEYS.USER, JSON.stringify(user));
  },

  getUser<T>(): T | null {
    const raw = mmkv.getString(KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  clearUser(): void {
    mmkv.remove(KEYS.USER);
  },

  setSetupCompleted(): void {
    mmkv.set(KEYS.SETUP_COMPLETED, '1');
  },

  isSetupCompleted(): boolean {
    return mmkv.getString(KEYS.SETUP_COMPLETED) === '1';
  },

  clearSetupCompleted(): void {
    mmkv.remove(KEYS.SETUP_COMPLETED);
  },

  saveDriverId(id: string): void {
    mmkv.set(KEYS.DRIVER_ID, id);
  },

  getDriverId(): string | null {
    return mmkv.getString(KEYS.DRIVER_ID) ?? null;
  },

  clearDriverId(): void {
    mmkv.remove(KEYS.DRIVER_ID);
  },

  savePushToken(token: string): void {
    mmkv.set(KEYS.PUSH_TOKEN, token);
  },

  getPushToken(): string | null {
    return mmkv.getString(KEYS.PUSH_TOKEN) ?? null;
  },

  clearPushToken(): void {
    mmkv.remove(KEYS.PUSH_TOKEN);
  },

  // Onboarding flag — persisted to SecureStore so it survives app restarts
  async setOnboarded(): Promise<void> {
    await SecureStore.setItemAsync('onboarded_v1', '1');
  },

  async isOnboarded(): Promise<boolean> {
    const val = await SecureStore.getItemAsync('onboarded_v1');
    return val === '1';
  },

  // Generic cache (fast key-value, in-memory only)
  set(key: string, value: string): void {
    mmkv.set(key, value);
  },

  get(key: string): string | undefined {
    return mmkv.getString(key);
  },

  delete(key: string): void {
    mmkv.remove(key);
  },
};
