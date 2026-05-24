import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeliveryRunsService } from '../../services/api/delivery-runs.service';
import { ShipmentsService } from '../../services/api/shipments.service';
import { Button } from '../ui/Button';
import type { DeliveryRun, RunStop, Shipment } from '../../types';

interface Props {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  run: DeliveryRun;
  onDone: (updatedRun: DeliveryRun) => void;
}

type Tab = 'current' | 'add';

export function EditStopsSheet({ sheetRef, run, onDone }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('current');
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    setTab('current');
    setSelectedToAdd(new Set());
  }, [run.id]);

  const { data: availableShipments, isLoading: loadingShipments } = useQuery({
    queryKey: ['shipments', 'unassigned'],
    queryFn: () => ShipmentsService.getAll({ status: 'confirmed', limit: 100 }),
    select: (res) => res.data.filter((s: Shipment) => s.deliveryRunId === null),
    enabled: tab === 'add',
  });

  const removeMutation = useMutation({
    mutationFn: (stopId: string) => DeliveryRunsService.removeShipments(run.id, [stopId]),
    onMutate: (stopId) => setRemovingId(stopId),
    onSuccess: (updatedRun) => {
      setRemovingId(null);
      queryClient.setQueryData(['delivery-runs', run.id], updatedRun);
      queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
      onDone(updatedRun);
    },
    onError: (err: any) => {
      setRemovingId(null);
      const msg = err?.response?.data?.message ?? 'No se pudo eliminar la parada.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const addMutation = useMutation({
    mutationFn: (ids: string[]) => DeliveryRunsService.addShipments(run.id, ids),
    onSuccess: (updatedRun) => {
      queryClient.setQueryData(['delivery-runs', run.id], updatedRun);
      queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
      queryClient.invalidateQueries({ queryKey: ['shipments', 'unassigned'] });
      setSelectedToAdd(new Set());
      setTab('current');
      onDone(updatedRun);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudieron agregar las entregas.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const handleRemove = (stop: RunStop) => {
    Alert.alert(
      'Eliminar parada',
      `¿Eliminar "${stop.address || stop.id.slice(-6).toUpperCase()}" del run?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removeMutation.mutate(stop.id) },
      ]
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sortedStops = [...(run.stops ?? [])].sort((a, b) => a.sequence - b.sequence);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['60%', '90%']}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
      backgroundStyle={{ backgroundColor: '#fff' }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text
          className="text-text-primary text-lg font-bold mb-4 mt-1"
          style={{ fontFamily: 'Inter_700Bold' }}
        >
          Modificar paradas
        </Text>

        {/* Tabs */}
        <View className="flex-row bg-surface-secondary rounded-xl p-1 mb-5">
          {(['current', 'add'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
              className={`flex-1 py-2 rounded-lg items-center ${tab === t ? 'bg-white shadow-sm' : ''}`}
            >
              <Text
                className={`text-sm font-medium ${tab === t ? 'text-text-primary' : 'text-text-muted'}`}
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                {t === 'current' ? `Actuales (${sortedStops.length})` : 'Agregar'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Current stops tab ── */}
        {tab === 'current' && (
          <>
            {sortedStops.length === 0 && (
              <View className="items-center py-10">
                <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                  Este run no tiene paradas aún.
                </Text>
              </View>
            )}
            {sortedStops.map((stop, index) => (
              <View
                key={stop.id}
                className="flex-row items-center bg-white border border-border rounded-2xl px-4 py-3 mb-2"
              >
                <View className="w-7 h-7 bg-surface-secondary rounded-full items-center justify-center mr-3">
                  <Text
                    className="text-xs font-semibold text-text-secondary"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View className="flex-1 mr-2">
                  <Text
                    className="text-text-primary text-sm font-medium"
                    style={{ fontFamily: 'Inter_500Medium' }}
                    numberOfLines={1}
                  >
                    {stop.address || stop.trackingCode || stop.id.slice(-8).toUpperCase()}
                  </Text>
                  {(stop.trackingCode || stop.referenceNumber) && (
                    <Text
                      className="text-text-muted text-xs"
                      style={{ fontFamily: 'Inter_400Regular' }}
                    >
                      {stop.trackingCode ?? stop.referenceNumber}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => handleRemove(stop)}
                  disabled={removeMutation.isPending}
                  className="w-8 h-8 bg-red-50 rounded-full items-center justify-center"
                >
                  {removingId === stop.id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text className="text-red-500 text-lg leading-none">−</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* ── Add shipments tab ── */}
        {tab === 'add' && (
          <>
            {loadingShipments && (
              <View className="items-center py-10">
                <ActivityIndicator color="#22c55e" />
                <Text
                  className="text-text-muted text-sm mt-3"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  Cargando entregas disponibles...
                </Text>
              </View>
            )}

            {!loadingShipments && (availableShipments ?? []).length === 0 && (
              <View className="items-center py-10">
                <Text
                  className="text-text-muted text-sm text-center"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  No hay entregas confirmadas disponibles para agregar.
                </Text>
              </View>
            )}

            {!loadingShipments &&
              (availableShipments ?? []).map((shipment: Shipment) => {
                const selected = selectedToAdd.has(shipment.id);
                return (
                  <TouchableOpacity
                    key={shipment.id}
                    onPress={() => toggleSelect(shipment.id)}
                    activeOpacity={0.75}
                    className={`flex-row items-center border rounded-2xl px-4 py-3 mb-2 ${
                      selected ? 'bg-primary-50 border-primary-400' : 'bg-white border-border'
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded border mr-3 items-center justify-center ${
                        selected ? 'bg-primary-500 border-primary-500' : 'border-border bg-white'
                      }`}
                    >
                      {selected && (
                        <Text className="text-white text-xs font-bold">✓</Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-text-primary text-sm font-medium"
                        style={{ fontFamily: 'Inter_500Medium' }}
                        numberOfLines={1}
                      >
                        {shipment.destinationAddress}
                      </Text>
                      <Text
                        className="text-text-muted text-xs"
                        style={{ fontFamily: 'Inter_400Regular' }}
                      >
                        {shipment.trackingCode}
                        {shipment.referenceNumber ? ` · ${shipment.referenceNumber}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

            {selectedToAdd.size > 0 && (
              <Button
                fullWidth
                size="lg"
                loading={addMutation.isPending}
                onPress={() => addMutation.mutate(Array.from(selectedToAdd))}
                className="mt-4"
              >
                Agregar {selectedToAdd.size} entrega{selectedToAdd.size !== 1 ? 's' : ''}
              </Button>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
