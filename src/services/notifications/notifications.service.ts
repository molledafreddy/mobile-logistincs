import * as ExpoNotifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { AuthService } from '../api/auth.service';
import { StorageService } from '../storage/storage.service';

// Foreground: mostrar notificaciones como banner mientras la app está abierta
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const PushNotificationsService = {
  async registerToken(): Promise<string | null> {
    if (!Device.isDevice) return null; // simuladores no soportan push

    const { status: existing } = await ExpoNotifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await ExpoNotifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // Canal Android (requerido para Android 8+)
    if (Platform.OS === 'android') {
      await ExpoNotifications.setNotificationChannelAsync('default', {
        name: 'Logistics',
        importance: ExpoNotifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22c55e',
      });
    }

    const tokenData = await ExpoNotifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    const token = tokenData.data;
    const platform = Platform.OS as 'ios' | 'android';

    await AuthService.registerDeviceToken(token, platform);
    StorageService.savePushToken(token);

    return token;
  },

  // Listener: notificación recibida con app en primer plano
  onForegroundNotification(
    handler: (notification: ExpoNotifications.Notification) => void
  ): () => void {
    const sub = ExpoNotifications.addNotificationReceivedListener(handler);
    return () => sub.remove();
  },

  // Listener: usuario tocó la notificación (app en fondo o cerrada)
  onNotificationResponse(
    handler: (response: ExpoNotifications.NotificationResponse) => void
  ): () => void {
    const sub = ExpoNotifications.addNotificationResponseReceivedListener(handler);
    return () => sub.remove();
  },

  // Navegar a la pantalla correcta según el tipo de notificación
  handleNotificationTap(data: Record<string, string> | undefined) {
    if (!data) return;

    const { type, runId, conversationId } = data;

    switch (type) {
      case 'run_assigned':
      case 'run_updated':
        if (runId) router.push(`/(app)/delivery/${runId}`);
        break;
      case 'message_received':
        if (conversationId) router.push(`/(app)/(tabs)/chat/${conversationId}`);
        break;
      case 'expense_approved':
      case 'expense_rejected':
        router.push('/(app)/(tabs)/expenses');
        break;
      default:
        router.push('/(app)/notifications');
    }
  },

  async getBadgeCount(): Promise<number> {
    return ExpoNotifications.getBadgeCountAsync();
  },

  async clearBadge(): Promise<void> {
    await ExpoNotifications.setBadgeCountAsync(0);
  },
};
