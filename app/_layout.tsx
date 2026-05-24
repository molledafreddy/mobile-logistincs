import '../global.css';
import { useEffect, useCallback } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import * as ExpoNotifications from 'expo-notifications';
import { useAuthStore } from '../src/stores/auth.store';
import { authEventEmitter } from '../src/services/api/client';
import { PushNotificationsService } from '../src/services/notifications/notifications.service';
import { StorageService } from '../src/services/storage/storage.service';
import { OfflineQueue } from '../src/services/offline/offline-queue.service';
import { NetworkBanner } from '../src/components/common/NetworkBanner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

function AppProviders({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const logout = useAuthStore((s) => s.logout);

  // ── Auth hydration ──────────────────────────────────────────────────────────
  useEffect(() => {
    hydrateFromStorage();
    return authEventEmitter.on('logout', logout);
  }, []);

  // ── Push Notifications ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    PushNotificationsService.registerToken().catch(() => undefined);
    PushNotificationsService.clearBadge().catch(() => undefined);

    // Cold start: app killed and reopened from a notification tap.
    // We track the last-handled identifier so we don't re-navigate on every login.
    ExpoNotifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const notifId = response.notification.request.identifier;
      const alreadyHandled = StorageService.get('last_handled_notif_id') === notifId;
      if (alreadyHandled) return;
      StorageService.set('last_handled_notif_id', notifId);
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      PushNotificationsService.handleNotificationTap(data);
    }).catch(() => undefined);

    const unsubFg = PushNotificationsService.onForegroundNotification(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    const unsubTap = PushNotificationsService.onNotificationResponse((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      PushNotificationsService.handleNotificationTap(data);
    });

    return () => {
      unsubFg();
      unsubTap();
    };
  }, [isAuthenticated]);

  // ── Offline queue auto-sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    return OfflineQueue.startAutoSync();
  }, [isAuthenticated]);

  // ── Deep link handler ───────────────────────────────────────────────────────
  const handleDeepLink = useCallback(
    (url: string) => {
      const parsed = Linking.parse(url);

      // logistics://activate?token=xxx
      if (parsed.path === 'activate' && parsed.queryParams?.token) {
        const token = String(parsed.queryParams.token);
        router.push({ pathname: '/(auth)/activate', params: { token } });
        return;
      }

      // logistics://run/abc123
      if (parsed.path?.startsWith('run/') && isAuthenticated) {
        const runId = parsed.path.replace('run/', '');
        router.push(`/(app)/delivery/${runId}`);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    // App ya abierta: escuchar links entrantes
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    // App recién abierta desde un link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => sub.remove();
  }, [handleDeepLink]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView className="flex-1">
      <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <AppProviders>
            <NetworkBanner />
            <Stack screenOptions={{ headerShown: false }} />
          </AppProviders>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
