import { Redirect, Stack } from 'expo-router';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useEffect } from 'react';
import { useAuthStore } from '../../src/stores/auth.store';
import { SocketService } from '../../src/services/socket/socket.service';
import { SocketEvent } from '../../src/services/socket/socket.events';
import { useUIStore } from '../../src/stores/ui.store';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const incrementUnreadMessages = useUIStore((s) => s.incrementUnreadMessages);
  const incrementUnreadNotifications = useUIStore((s) => s.incrementUnreadNotifications);

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubMsg = SocketService.on(SocketEvent.NEW_MESSAGE, () => {
      incrementUnreadMessages();
    });

    const unsubNotif = SocketService.on(SocketEvent.NOTIFICATION, () => {
      incrementUnreadNotifications();
    });

    return () => {
      unsubMsg();
      unsubNotif();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <BottomSheetModalProvider>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="delivery/[runId]/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="tracking/active" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="notifications/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="my-truck" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="shipments/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="change-password" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="fleet/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="templates/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="metrics" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="verification/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="billing/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="plans/index" options={{ animation: 'slide_from_right' }} />
    </Stack>
    </BottomSheetModalProvider>
  );
}
