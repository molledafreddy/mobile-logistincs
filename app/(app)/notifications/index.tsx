import { FlatList, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { NotificationsService } from '../../../src/services/api/notifications.service';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Button } from '../../../src/components/ui/Button';
import { useUIStore } from '../../../src/stores/ui.store';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AppNotification } from '../../../src/types';

const TYPE_ICONS: Record<string, string> = {
  run_assigned: '📦',
  run_updated: '🔄',
  message_received: '💬',
  expense_approved: '✅',
  expense_rejected: '❌',
  general: '🔔',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return `Hoy · ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Ayer · ${format(d, 'HH:mm')}`;
  return format(d, "d MMM · HH:mm", { locale: es });
}

function NotificationItem({ notification }: { notification: AppNotification }) {
  const queryClient = useQueryClient();

  const markReadMutation = useMutation({
    mutationFn: () => NotificationsService.markRead(notification.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <TouchableOpacity
      onPress={() => !notification.readAt && markReadMutation.mutate()}
      activeOpacity={0.7}
      className={`flex-row items-start px-4 py-4 border-b border-border
        ${!notification.readAt ? 'bg-primary-50' : 'bg-white'}`}
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 mt-0.5
        ${!notification.readAt ? 'bg-primary-100' : 'bg-surface-tertiary'}`}>
        <Text className="text-xl">{TYPE_ICONS[notification.type] ?? '🔔'}</Text>
      </View>

      <View className="flex-1">
        <View className="flex-row items-start justify-between mb-0.5">
          <Text
            className={`flex-1 mr-2 font-medium ${!notification.readAt ? 'text-text-primary' : 'text-text-secondary'}`}
            style={{ fontFamily: 'Inter_500Medium' }}
          >
            {notification.title}
          </Text>
          {!notification.readAt && (
            <View className="w-2.5 h-2.5 bg-primary-500 rounded-full mt-1.5" />
          )}
        </View>
        <Text className="text-text-muted text-sm mb-1" numberOfLines={2} style={{ fontFamily: 'Inter_400Regular' }}>
          {notification.body}
        </Text>
        <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
          {formatDate(notification.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUnreadNotifications = useUIStore((s) => s.setUnreadNotifications);

  // Reset badge when the screen is opened
  useEffect(() => {
    setUnreadNotifications(0);
  }, []);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => NotificationsService.getNotifications({ limit: 50 }),
  });

  const markAllMutation = useMutation({
    mutationFn: NotificationsService.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 bg-surface-secondary rounded-full items-center justify-center border border-border mr-3"
          activeOpacity={0.7}
        >
          <Text className="text-text-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-xl text-text-primary font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
          Notificaciones
          {unreadCount > 0 && (
            <Text className="text-primary-500 text-base"> ({unreadCount})</Text>
          )}
        </Text>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            loading={markAllMutation.isPending}
            onPress={() => markAllMutation.mutate()}
          >
            Leer todo
          </Button>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" />
        }
        renderItem={({ item }) => <NotificationItem notification={item} />}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="🔔"
              title="Sin notificaciones"
              description="Aquí aparecerán tus alertas y actualizaciones."
            />
          )
        }
      />
    </SafeAreaView>
  );
}
