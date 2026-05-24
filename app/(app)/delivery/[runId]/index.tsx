import { useState, useRef } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert, RefreshControl, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeliveryRunsService } from '../../../../src/services/api/delivery-runs.service';
import { useTrackingStore } from '../../../../src/stores/tracking.store';
import { LocationService } from '../../../../src/services/location/location.service';
import { useDeliveryFlow } from '../../../../src/features/delivery-runs/useDeliveryFlow';
import { usePlanPermission } from '../../../../src/features/auth/usePlanPermission';
import { ComplianceGuard } from '../../../../src/components/common/ComplianceGuard';
import { StopCard } from '../../../../src/components/delivery/StopCard';
import { StopDetailSheet } from '../../../../src/components/delivery/StopDetailSheet';
import { EditRunSheet } from '../../../../src/components/delivery/EditRunSheet';
import { CancelRunSheet } from '../../../../src/components/delivery/CancelRunSheet';
import { EditStopsModal } from '../../../../src/components/delivery/EditStopsModal';
import { RunProgressBar } from '../../../../src/components/delivery/RunProgressBar';
import { RunStatusBadge } from '../../../../src/components/ui/Badge';
import { Button } from '../../../../src/components/ui/Button';
import { RunDetailSkeleton } from '../../../../src/components/ui/Skeleton';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import type { DeliveryRun, RunStop } from '../../../../src/types';

export default function RunDetailScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isTracking, startTracking, stopTracking } = useTrackingStore();
  const flow = useDeliveryFlow();

  const stopSheetRef = useRef<BottomSheetModalMethods>(null);
  const editSheetRef = useRef<BottomSheetModalMethods>(null);
  const cancelSheetRef = useRef<BottomSheetModalMethods>(null);
  const [selectedStop, setSelectedStop] = useState<RunStop | null>(null);
  const [selectedStopIndex, setSelectedStopIndex] = useState(0);

  const openStopSheet = (stop: RunStop, idx: number) => {
    setSelectedStop(stop);
    setSelectedStopIndex(idx);
    stopSheetRef.current?.present();
  };

  const handleStopAction = () => {
    stopSheetRef.current?.dismiss();
    if (selectedStop) router.push(flow.getStopRoute(runId, selectedStop.id) as any);
  };

  const handleStopIncident = () => {
    stopSheetRef.current?.dismiss();
    if (selectedStop) router.push(`${flow.getStopRoute(runId, selectedStop.id)}?initialStep=incident` as any);
  };

  const { data: run, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['delivery-runs', runId],
    queryFn: () => DeliveryRunsService.getRunById(runId),
    refetchInterval: isTracking ? 20_000 : false,
  });

  const startMutation = useMutation({
    mutationFn: () => DeliveryRunsService.startRun(runId),
    onSuccess: async (updatedRun) => {
      queryClient.setQueryData(['delivery-runs', runId], updatedRun);
      queryClient.invalidateQueries({ queryKey: ['delivery-runs', 'active'] });
      try {
        await startTracking(runId);
      } catch {
        Alert.alert(
          'Run iniciado',
          'El run fue iniciado pero el GPS no pudo activarse. Verifica los permisos de ubicación.',
          [
            { text: 'OK' },
            { text: 'Configuración', onPress: () => Linking.openSettings() },
          ]
        );
      }
    },
    onError: () => Alert.alert('Error', 'No se pudo iniciar el run. Intenta de nuevo.'),
  });

  const completeMutation = useMutation({
    mutationFn: () => DeliveryRunsService.completeRun(runId),
    onSuccess: async (updatedRun) => {
      queryClient.setQueryData(['delivery-runs', runId], updatedRun);
      queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
      await stopTracking();
      Alert.alert('¡Run completado!', 'Todas las entregas han sido finalizadas.', [
        { text: 'OK', onPress: () => router.replace('/(app)/(tabs)/home') },
      ]);
    },
    onError: () => Alert.alert('Error', 'No se pudo completar el run.'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof DeliveryRunsService.update>[1]) =>
      DeliveryRunsService.update(runId, payload),
    onSuccess: (updatedRun) => {
      queryClient.setQueryData(['delivery-runs', runId], updatedRun);
      queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
      editSheetRef.current?.dismiss();
    },
    onError: () => Alert.alert('Error', 'No se pudo actualizar el run.'),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => DeliveryRunsService.cancel(runId, reason),
    onSuccess: (updatedRun) => {
      queryClient.setQueryData(['delivery-runs', runId], updatedRun);
      queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
      cancelSheetRef.current?.dismiss();
      router.back();
    },
    onError: () => Alert.alert('Error', 'No se pudo cancelar el run.'),
  });

  const canOptimize = usePlanPermission('optimization.basic');

  const [showEditStops, setShowEditStops] = useState(false);
  const [reorderedIds, setReorderedIds] = useState<Set<string>>(new Set());

  const optimizeMutation = useMutation({
    mutationFn: () => DeliveryRunsService.optimizeRun(runId),
    onSuccess: (updatedRun) => {
      const prevRun = queryClient.getQueryData<DeliveryRun>(['delivery-runs', runId]);
      const prevSeq = new Map((prevRun?.stops ?? []).map((s) => [s.id, s.sequence]));

      queryClient.setQueryData(['delivery-runs', runId], updatedRun);

      const moved = new Set(
        (updatedRun.stops ?? [])
          .filter((s) => prevSeq.has(s.id) && prevSeq.get(s.id) !== s.sequence)
          .map((s) => s.id)
      );

      if (moved.size > 0) {
        setReorderedIds(moved);
        setTimeout(() => setReorderedIds(new Set()), 4000);
      } else {
        Alert.alert('Ruta optimizada', 'El orden de las paradas ya era el óptimo.');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo optimizar la ruta.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const handleOptimize = () => {
    if (!canOptimize) {
      Alert.alert(
        '🔒 Función de pago',
        'La optimización de rutas está disponible desde el plan Pro. Actualiza tu plan para reducir distancia y tiempo de entrega automáticamente.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Ver planes', onPress: () => router.push('/(app)/plans' as any) },
        ]
      );
      return;
    }
    Alert.alert(
      'Optimizar ruta',
      'Se reordenarán las paradas para minimizar distancia y tiempo. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Optimizar', onPress: () => optimizeMutation.mutate() },
      ]
    );
  };

  const handleStartRun = async () => {
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
    Alert.alert(
      'Iniciar run',
      '¿Listo para comenzar? Se activará el tracking de ubicación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Iniciar', onPress: () => startMutation.mutate() },
      ]
    );
  };

  const handleCompleteRun = () => {
    const pending = run?.stops?.filter((s) => s.status === 'pending').length ?? 0;
    if (pending > 0) {
      Alert.alert('Paradas pendientes', `Aún tienes ${pending} parada(s) sin completar.`);
      return;
    }
    Alert.alert('Completar run', '¿Confirmas que todas las entregas están finalizadas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Completar', onPress: () => completeMutation.mutate() },
    ]);
  };

  const TERMINAL = new Set(['delivered', 'failed']);
  const sortedStops = [...(run?.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const nextActiveStop = sortedStops.find((s) => !TERMINAL.has(s.status));

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-secondary">
        <RunDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (!run) {
    return (
      <SafeAreaView className="flex-1 bg-surface-secondary items-center justify-center">
        <Text className="text-text-muted">Run no encontrado</Text>
      </SafeAreaView>
    );
  }

  return (
    <ComplianceGuard required={flow.requiresComplianceCheck()}>
      <SafeAreaView className="flex-1 bg-surface-secondary">
        {/* Header */}
        <View className="flex-row items-center px-4 pt-4 pb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 bg-white rounded-full items-center justify-center border border-border mr-3"
          >
            <Text className="text-text-primary">←</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <Text
              className="text-text-primary text-lg font-bold"
              style={{ fontFamily: 'Inter_700Bold' }}
            >
              Run #{run.id.slice(-6).toUpperCase()}
            </Text>
            {run.truckPlate ? (
              <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                {flow.getRunTypeIcon()} {run.truckPlate} · {flow.getRunTypeLabel()}
              </Text>
            ) : (
              <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                {flow.getRunTypeIcon()} {flow.getRunTypeLabel()}
              </Text>
            )}
          </View>
          <View className="flex-row items-center gap-x-2">
            <RunStatusBadge status={run.status} />
            {run.status === 'planned' || run.status === 'ready' && (
              <TouchableOpacity
                onPress={() => editSheetRef.current?.present()}
                className="w-8 h-8 bg-white rounded-full items-center justify-center border border-border"
              >
                <Text className="text-sm">✏️</Text>
              </TouchableOpacity>
            )}
            {isTracking && run.status === 'in_progress' && (
              <TouchableOpacity
                onPress={() => router.push('/(app)/tracking/active')}
                className="bg-primary-500 rounded-full px-3 py-1"
              >
                <Text
                  className="text-white text-xs font-medium"
                  style={{ fontFamily: 'Inter_500Medium' }}
                >
                  🗺 Mapa
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-8"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" />
          }
        >
          {/* Progress */}
          <RunProgressBar run={run} />

          {/* Action buttons */}
          {(run.status === 'planned' || run.status === 'ready') && (
            <View className="mb-4 gap-y-2">
              <Button
                fullWidth
                size="lg"
                loading={startMutation.isPending}
                onPress={handleStartRun}
              >
                🚀 Iniciar run
              </Button>
              <Button
                variant="outline"
                fullWidth
                size="sm"
                loading={optimizeMutation.isPending}
                onPress={handleOptimize}
              >
                🗺 Optimizar ruta
              </Button>
              <Button
                variant="outline"
                fullWidth
                size="sm"
                onPress={() => setShowEditStops(true)}
              >
                📦 Modificar paradas
              </Button>
              <Button
                variant="outline"
                fullWidth
                size="sm"
                onPress={() => cancelSheetRef.current?.present()}
              >
                ✕ Cancelar run
              </Button>
            </View>
          )}

          {run.status === 'in_progress' && (
            <View className="mb-4 gap-y-2">
              <Button
                fullWidth
                size="lg"
                onPress={() => router.push({ pathname: '/(app)/tracking/active', params: { runId } })}
              >
                🗺 Ver mapa de tracking
              </Button>
              {run.completedStops === run.totalStops && (
                <Button
                  fullWidth
                  size="lg"
                  variant="outline"
                  loading={completeMutation.isPending}
                  onPress={handleCompleteRun}
                >
                  ✅ Completar run
                </Button>
              )}
            </View>
          )}

          {/* Stops list */}
          <Text
            className="text-text-primary font-semibold mb-3"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Paradas ({run.stops?.length ?? 0})
          </Text>

          {optimizeMutation.isPending && (
            <View className="flex-row items-center gap-x-3 bg-primary-50 border border-primary-200 rounded-2xl px-4 py-3 mb-3">
              <Text className="text-lg">🗺</Text>
              <View>
                <Text className="text-primary-700 font-semibold text-sm" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Calculando ruta óptima...
                </Text>
                <Text className="text-primary-600 text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                  Reordenando paradas para minimizar distancia
                </Text>
              </View>
            </View>
          )}

          {reorderedIds.size > 0 && (
            <View className="flex-row items-center gap-x-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 mb-3">
              <Text>↕️</Text>
              <Text className="text-amber-700 text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
                {reorderedIds.size} parada{reorderedIds.size !== 1 ? 's' : ''} reordenada{reorderedIds.size !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {(run.stops ?? [])
            .sort((a, b) => a.sequence - b.sequence)
            .map((stop: RunStop, idx: number) => (
              <StopCard
                key={stop.id}
                stop={stop}
                index={idx}
                isActive={stop.id === nextActiveStop?.id && run.status === 'in_progress'}
                isOptimizing={optimizeMutation.isPending}
                isReordered={reorderedIds.has(stop.id)}
                actionLabel={flow.getStopActionLabel(run, stop)}
                onPress={() => openStopSheet(stop, idx)}
              />
            ))}
        </ScrollView>

        <StopDetailSheet
          sheetRef={stopSheetRef}
          stop={selectedStop}
          stopIndex={selectedStopIndex}
          actionLabel={
            selectedStop && run && selectedStop.id === nextActiveStop?.id
              ? flow.getStopActionLabel(run, selectedStop)
              : undefined
          }
          onAction={handleStopAction}
          onIncident={
            selectedStop?.status === 'arrived' && selectedStop.id === nextActiveStop?.id
              ? handleStopIncident
              : undefined
          }
        />

        <EditRunSheet
          sheetRef={editSheetRef}
          run={run}
          isLoading={updateMutation.isPending}
          onSubmit={(payload) => updateMutation.mutate(payload)}
        />

        <CancelRunSheet
          sheetRef={cancelSheetRef}
          runName={run.name ?? `Run #${run.id.slice(-6).toUpperCase()}`}
          isLoading={cancelMutation.isPending}
          onConfirm={(reason) => cancelMutation.mutate(reason)}
        />

        <EditStopsModal
          visible={showEditStops}
          run={run}
          onClose={() => setShowEditStops(false)}
          onUpdated={(updatedRun) => {
            queryClient.setQueryData(['delivery-runs', runId], updatedRun);
            queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
          }}
        />
      </SafeAreaView>
    </ComplianceGuard>
  );
}
