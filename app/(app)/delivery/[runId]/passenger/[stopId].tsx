import { ScrollView, View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PassengersService } from '../../../../../src/services/api/passengers.service';
import { Button } from '../../../../../src/components/ui/Button';
import type { Passenger, PassengerStatus } from '../../../../../src/types';

type PassengerAction = 'check_in' | 'check_out' | 'absent' | null;

const STATUS_CONFIG: Record<PassengerStatus, { label: string; dotColor: string; rowBg: string }> = {
  pending:    { label: 'Pendiente',  dotColor: 'bg-amber-400',   rowBg: 'bg-white' },
  checked_in: { label: 'A bordo',    dotColor: 'bg-primary-500', rowBg: 'bg-primary-50' },
  checked_out: { label: 'Bajado',   dotColor: 'bg-slate-400',   rowBg: 'bg-surface-secondary' },
  absent:     { label: 'Ausente',    dotColor: 'bg-red-400',     rowBg: 'bg-red-50' },
};

function getAvailableAction(status: PassengerStatus, isPickupStop: boolean): PassengerAction {
  if (status === 'checked_out' || status === 'absent') return null;
  if (isPickupStop && status === 'pending') return 'check_in';
  if (!isPickupStop && status === 'checked_in') return 'check_out';
  return null;
}

interface PassengerRowProps {
  passenger: Passenger;
  isPickupStop: boolean;
  onAction: (action: PassengerAction) => void;
  isLoading: boolean;
}

function PassengerRow({ passenger, isPickupStop, onAction, isLoading }: PassengerRowProps) {
  const cfg = STATUS_CONFIG[passenger.status];
  const action = getAvailableAction(passenger.status, isPickupStop);

  return (
    <View className={`${cfg.rowBg} rounded-2xl border border-border p-4 mb-3`}>
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center flex-1 mr-3">
          <View className={`w-2.5 h-2.5 rounded-full mr-2.5 ${cfg.dotColor}`} />
          <Text
            className="text-text-primary font-semibold flex-1"
            numberOfLines={1}
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            {passenger.name}
          </Text>
        </View>
        <View className="bg-white border border-border rounded-lg px-2 py-0.5">
          <Text className="text-text-secondary text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            {cfg.label}
          </Text>
        </View>
      </View>

      {passenger.guardianName && (
        <Text className="text-text-muted text-xs mb-1" style={{ fontFamily: 'Inter_400Regular' }}>
          👤 Tutor: {passenger.guardianName}
        </Text>
      )}
      {passenger.phone && (
        <Text className="text-text-muted text-xs mb-1" style={{ fontFamily: 'Inter_400Regular' }}>
          📞 {passenger.phone}
        </Text>
      )}

      {action && (
        <View className="flex-row gap-x-2 mt-3">
          <Button
            variant={action === 'check_in' ? 'primary' : 'secondary'}
            size="sm"
            loading={isLoading}
            onPress={() => onAction(action)}
          >
            {action === 'check_in' ? '✓ Subió' : '✓ Bajó'}
          </Button>
          {action === 'check_in' && (
            <Button
              variant="outline"
              size="sm"
              loading={isLoading}
              onPress={() => onAction('absent')}
            >
              Ausente
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

export default function PassengerStopScreen() {
  const { runId, stopId } = useLocalSearchParams<{ runId: string; stopId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: passengerRun, isLoading } = useQuery({
    queryKey: ['passenger-run', runId],
    queryFn: () => PassengersService.getPassengerRun(runId),
    refetchInterval: 20_000,
  });

  const stop = passengerRun?.stops.find((s) => s.id === stopId);
  const isPickupStop = stop?.type !== 'dropoff';

  const updateCache = (updated: Passenger) => {
    queryClient.setQueryData(['passenger-run', runId], (old: typeof passengerRun) => {
      if (!old) return old;
      const passengers = old.passengers.map((p) => (p.id === updated.id ? updated : p));
      const checkedInCount = passengers.filter((p) => p.status === 'checked_in').length;
      return { ...old, passengers, checkedInCount };
    });
  };

  const checkInMutation = useMutation({
    mutationFn: (passengerId: string) => PassengersService.checkInPassenger(runId, passengerId),
    onSuccess: async (updated) => {
      updateCache(updated);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert('Error', 'No se pudo registrar el abordaje.'),
  });

  const checkOutMutation = useMutation({
    mutationFn: (passengerId: string) => PassengersService.checkOutPassenger(runId, passengerId),
    onSuccess: async (updated) => {
      updateCache(updated);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert('Error', 'No se pudo registrar la bajada.'),
  });

  const absentMutation = useMutation({
    mutationFn: (passengerId: string) => PassengersService.markAbsent(runId, passengerId),
    onSuccess: async (updated) => {
      updateCache(updated);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: () => Alert.alert('Error', 'No se pudo marcar como ausente.'),
  });

  const isMutating =
    checkInMutation.isPending || checkOutMutation.isPending || absentMutation.isPending;

  const handleAction = (passenger: Passenger, action: PassengerAction) => {
    if (!action) return;
    if (action === 'check_in') return checkInMutation.mutate(passenger.id);
    if (action === 'check_out') return checkOutMutation.mutate(passenger.id);
    if (action === 'absent') {
      Alert.alert(
        'Marcar ausente',
        `¿${passenger.name} no se presentó en esta parada?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Marcar ausente',
            style: 'destructive',
            onPress: () => absentMutation.mutate(passenger.id),
          },
        ]
      );
    }
  };

  const handleFinishStop = () => {
    queryClient.invalidateQueries({ queryKey: ['delivery-runs', runId] });
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-secondary items-center justify-center">
        <ActivityIndicator color="#22c55e" />
        <Text className="text-text-muted mt-3 text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
          Cargando pasajeros...
        </Text>
      </SafeAreaView>
    );
  }

  const passengers = passengerRun?.passengers ?? [];
  const onBoard = passengerRun?.checkedInCount ?? 0;
  const pending = passengers.filter((p) => p.status === 'pending').length;
  const total = passengerRun?.totalPassengers ?? 0;
  const serviceLabel =
    passengerRun?.serviceSubtype === 'school'
      ? '🏫 Escolar'
      : passengerRun?.serviceSubtype === 'medical'
      ? '🏥 Médico'
      : passengerRun?.serviceSubtype === 'tourism'
      ? '🌍 Turismo'
      : '🚌 Pasajeros';

  return (
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
            {isPickupStop ? 'Abordaje' : 'Bajada'} — {serviceLabel}
          </Text>
          {stop && (
            <Text
              className="text-text-muted text-xs"
              numberOfLines={1}
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              📍 {stop.address}
            </Text>
          )}
        </View>
      </View>

      {/* Stats bar */}
      <View className="flex-row px-4 gap-x-3 mb-4">
        <View className="flex-1 bg-primary-50 rounded-2xl p-3 border border-primary-100 items-center">
          <Text
            className="text-primary-600 text-2xl font-bold"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            {onBoard}
          </Text>
          <Text className="text-primary-500 text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            A bordo
          </Text>
        </View>
        <View className="flex-1 bg-amber-50 rounded-2xl p-3 border border-amber-100 items-center">
          <Text
            className="text-amber-600 text-2xl font-bold"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            {pending}
          </Text>
          <Text className="text-amber-500 text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            Pendientes
          </Text>
        </View>
        <View className="flex-1 bg-white rounded-2xl p-3 border border-border items-center">
          <Text
            className="text-text-secondary text-2xl font-bold"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            {total}
          </Text>
          <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            Total
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {passengers.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-4xl mb-3">🚌</Text>
            <Text
              className="text-text-secondary text-base"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Sin pasajeros asignados
            </Text>
          </View>
        ) : (
          passengers.map((passenger) => (
            <PassengerRow
              key={passenger.id}
              passenger={passenger}
              isPickupStop={isPickupStop}
              onAction={(action) => handleAction(passenger, action)}
              isLoading={isMutating}
            />
          ))
        )}

        <Button fullWidth size="lg" className="mt-2" onPress={handleFinishStop}>
          Finalizar parada
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
