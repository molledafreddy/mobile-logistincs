import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { useTrackingStore } from '../../../../src/stores/tracking.store';
import { useUIStore } from '../../../../src/stores/ui.store';
import { useDeliveryFlow } from '../../../../src/features/delivery-runs/useDeliveryFlow';
import { DeliveryRunsService } from '../../../../src/services/api/delivery-runs.service';
import { LocationService } from '../../../../src/services/location/location.service';
import { Card } from '../../../../src/components/ui/Card';
import { RunStatusBadge } from '../../../../src/components/ui/Badge';
import { Button } from '../../../../src/components/ui/Button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DeliveryRun } from '../../../../src/types';

function ActiveRunCard({ run }: { run: DeliveryRun }) {
  const router = useRouter();
  const { isTracking, startTracking } = useTrackingStore();
  const completed = run.completedStops;
  const total = run.totalStops;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const handleStartTracking = async () => {
    if (isTracking) {
      router.push('/(app)/tracking/active');
      return;
    }
    const hasPermission = await LocationService.requestPermissions();
    if (!hasPermission) {
      Alert.alert(
        'Permiso de ubicación requerido',
        'Necesitamos acceso a tu ubicación en segundo plano para el tracking GPS durante el run.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuración', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    try {
      await startTracking(run.id);
      router.push('/(app)/tracking/active');
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el tracking. Verifica los permisos de ubicación.');
    }
  };

  return (
    <Card className="mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <View>
          <Text className="text-xs text-text-muted mb-1" style={{ fontFamily: 'Inter_400Regular' }}>
            Run activo
          </Text>
          <Text className="text-lg text-text-primary" style={{ fontFamily: 'Inter_700Bold' }}>
            #{run.id.slice(-6).toUpperCase()}
          </Text>
        </View>
        <RunStatusBadge status={run.status} />
      </View>

      {/* Progress bar */}
      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-xs text-text-secondary" style={{ fontFamily: 'Inter_500Medium' }}>
            Progreso
          </Text>
          <Text className="text-xs text-primary-600 font-medium" style={{ fontFamily: 'Inter_600SemiBold' }}>
            {completed}/{total} paradas
          </Text>
        </View>
        <View className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
          <View
            className="h-full bg-primary-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <View className="flex-row gap-x-3">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onPress={handleStartTracking}
        >
          {isTracking ? 'Ver mapa' : 'Iniciar tracking'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onPress={() => router.push(`/(app)/delivery/${run.id}`)}
        >
          Ver paradas
        </Button>
      </View>
    </Card>
  );
}

function UpcomingRunItem({ run, typeIcon }: { run: DeliveryRun; typeIcon: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      className="flex-row items-center bg-surface-secondary rounded-xl p-3 mb-2"
      onPress={() => router.push(`/(app)/delivery/${run.id}`)}
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 bg-primary-100 rounded-xl items-center justify-center mr-3">
        <Text className="text-lg">{typeIcon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
          Run #{run.id.slice(-6).toUpperCase()}
        </Text>
        <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
          {format(new Date(run.scheduledDate), "d MMM · HH:mm", { locale: es })} · {run.totalStops} paradas
        </Text>
      </View>
      <RunStatusBadge status={run.status} />
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const unreadNotifications = useUIStore((s) => s.unreadNotifications);
  const flow = useDeliveryFlow();

  const { data: activeRun, isLoading: activeLoading, refetch: refetchActive } = useQuery({
    queryKey: ['delivery-runs', 'active'],
    queryFn: DeliveryRunsService.getActiveRun,
    refetchInterval: 30_000,
  });

  const { data: scheduledRuns, isLoading: scheduledLoading, refetch: refetchScheduled } = useQuery({
    queryKey: ['delivery-runs', 'scheduled'],
    queryFn: () => DeliveryRunsService.getMyRuns({ status: 'ready', limit: 5 }),
  });

  const isRefreshing = activeLoading || scheduledLoading;

  const onRefresh = () => {
    refetchActive();
    refetchScheduled();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between pt-4 pb-6">
          <View>
            <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
              {greeting()},
            </Text>
            <Text className="text-text-primary text-2xl" style={{ fontFamily: 'Inter_700Bold' }}>
              {user?.firstName} 👋
            </Text>
          </View>
          <TouchableOpacity
            className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm border border-border"
            onPress={() => router.push('/(app)/notifications')}
          >
            <Text className="text-lg">🔔</Text>
            {unreadNotifications > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[16px] h-4 items-center justify-center px-1">
                <Text className="text-white text-[10px] font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Active run */}
        {activeRun ? (
          <View>
            <Text className="text-text-primary font-semibold mb-3" style={{ fontFamily: 'Inter_600SemiBold' }}>
              Run en curso
            </Text>
            <ActiveRunCard run={activeRun} />
          </View>
        ) : (
          <Card className="mb-4 items-center py-6">
            <Text className="text-3xl mb-2">✅</Text>
            <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
              Sin run activo por ahora
            </Text>
          </Card>
        )}

        {/* Upcoming runs */}
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-text-primary font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
              Próximos runs
            </Text>
            <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/runs')}>
              <Text className="text-primary-600 text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
                Ver todos →
              </Text>
            </TouchableOpacity>
          </View>

          {scheduledRuns?.data?.length ? (
            scheduledRuns.data.map((run) => <UpcomingRunItem key={run.id} run={run} typeIcon={flow.getRunTypeIcon()} />)
          ) : (
            <Card padding="sm">
              <Text className="text-text-muted text-sm text-center py-2" style={{ fontFamily: 'Inter_400Regular' }}>
                Sin runs programados
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
