import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { DeliveryRunsService } from '../../services/api/delivery-runs.service';
import { ShipmentsService } from '../../services/api/shipments.service';
import { AddressSearchInput } from '../common/AddressSearchInput';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { DeliveryRun, RunStop, Shipment, GeocodeFeature } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'current' | 'add';
type AddMode = 'existing' | 'new';

const shipmentSchema = z.object({
  originAddress: z.string().optional(),
  destinationAddress: z.string().min(5, 'Ingresa la dirección de destino'),
  description: z.string().min(2, 'Ingresa una descripción del envío'),
  destinationContactName: z.string().optional(),
  destinationContactPhone: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});
type ShipmentForm = z.infer<typeof shipmentSchema>;

const newShipmentSchema = z.object({
  originAddress: z.string().optional(),
  destinationAddress: z.string().min(5, 'Ingresa la dirección de destino'),
  description: z.string().min(2, 'Ingresa una descripción de la carga'),
  cargoType: z.enum(['general', 'fragile', 'refrigerated', 'hazmat', 'valuable']).optional(),
  weightKg: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Ej. 150.50').optional().or(z.literal('')),
  pieces: z.string().regex(/^\d+$/, 'Número entero').optional().or(z.literal('')),
  destinationContactName: z.string().optional(),
  destinationContactPhone: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});
type NewShipmentForm = z.infer<typeof newShipmentSchema>;

const CARGO_TYPES = [
  { value: 'general',      label: 'General' },
  { value: 'fragile',      label: 'Frágil' },
  { value: 'refrigerated', label: 'Refrigerado' },
  { value: 'hazmat',       label: 'Mat. peligrosos' },
  { value: 'valuable',     label: 'Valioso' },
] as const;

function stopToForm(stop: RunStop): ShipmentForm {
  return {
    originAddress: stop.originAddress ?? '',
    destinationAddress: stop.address ?? '',
    description: stop.description ?? '',
    destinationContactName: stop.contactName ?? '',
    destinationContactPhone: stop.contactPhone ?? '',
    referenceNumber: stop.referenceNumber ?? '',
    notes: stop.notes ?? '',
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  run: DeliveryRun;
  onClose: () => void;
  onUpdated: (updatedRun: DeliveryRun) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EditStopsModal({ visible, run, onClose, onUpdated }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isPassenger =
    (run.stops ?? []).some((s) => s.cargoType === 'passenger') ||
    !!(run as any).passengers;

  const [tab, setTab] = useState<Tab>('current');
  const [addMode, setAddMode] = useState<AddMode>('existing');
  const [editingStop, setEditingStop] = useState<RunStop | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [originFeature, setOriginFeature] = useState<GeocodeFeature | null>(null);
  const [destFeature, setDestFeature] = useState<GeocodeFeature | null>(null);
  const [editOriginFeature, setEditOriginFeature] = useState<GeocodeFeature | null>(null);
  const [editDestFeature, setEditDestFeature] = useState<GeocodeFeature | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const { data: availableShipments, isLoading: loadingShipments } = useQuery({
    queryKey: ['shipments', 'unassigned'],
    queryFn: () => ShipmentsService.getAll({ status: 'confirmed', limit: 100 }),
    select: (res) => res.data.filter((s: Shipment) => s.deliveryRunId === null),
    enabled: visible && tab === 'add' && addMode === 'existing',
  });

  const editForm = useForm<ShipmentForm>({ resolver: zodResolver(shipmentSchema), defaultValues: stopToForm({ id: '', sequence: 0, type: 'dropoff', status: 'pending', address: '', lat: 0, lng: 0 }) });
  const newForm = useForm<NewShipmentForm>({ resolver: zodResolver(newShipmentSchema), defaultValues: { originAddress: '', destinationAddress: '', description: '', cargoType: undefined, weightKg: '', pieces: '', destinationContactName: '', destinationContactPhone: '', referenceNumber: '', notes: '' } });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = (updatedRun: DeliveryRun) => {
    queryClient.setQueryData(['delivery-runs', run.id], updatedRun);
    queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
    onUpdated(updatedRun);
  };

  const removeMutation = useMutation({
    mutationFn: (stopId: string) => DeliveryRunsService.removeShipments(run.id, [stopId]),
    onMutate: (id) => setRemovingId(id),
    onSuccess: (updated) => { setRemovingId(null); invalidate(updated); },
    onError: (err: any) => {
      setRemovingId(null);
      const msg = err?.response?.data?.message ?? 'No se pudo eliminar la parada.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ShipmentForm }) =>
      ShipmentsService.update(id, {
        originAddress: values.originAddress || undefined,
        originLat: editOriginFeature?.coordinates.lat,
        originLng: editOriginFeature?.coordinates.lng,
        destinationAddress: values.destinationAddress,
        destinationLat: editDestFeature?.coordinates.lat,
        destinationLng: editDestFeature?.coordinates.lng,
        description: values.description,
        destinationContactName: values.destinationContactName || undefined,
        destinationContactPhone: values.destinationContactPhone || undefined,
        referenceNumber: values.referenceNumber || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-runs', run.id] });
      setEditingStop(null);
      setEditOriginFeature(null);
      setEditDestFeature(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo actualizar la parada.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const addExistingMutation = useMutation({
    mutationFn: (ids: string[]) => DeliveryRunsService.addShipments(run.id, ids),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['shipments', 'unassigned'] });
      setSelectedIds(new Set());
      setTab('current');
      invalidate(updated);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudieron agregar las entregas.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: NewShipmentForm) => {
      const shipment = await ShipmentsService.create({
        originAddress: values.originAddress || 'Sin especificar',
        originLat: originFeature?.coordinates.lat,
        originLng: originFeature?.coordinates.lng,
        destinationAddress: values.destinationAddress,
        destinationLat: destFeature?.coordinates.lat,
        destinationLng: destFeature?.coordinates.lng,
        description: values.description,
        cargoType: values.cargoType,
        weightKg: values.weightKg || undefined,
        pieces: values.pieces ? parseInt(values.pieces, 10) : undefined,
        destinationContactName: values.destinationContactName || undefined,
        destinationContactPhone: values.destinationContactPhone || undefined,
        referenceNumber: values.referenceNumber || undefined,
        notes: values.notes || undefined,
      });
      return DeliveryRunsService.addShipments(run.id, [shipment.id]);
    },
    onSuccess: (updated) => {
      newForm.reset();
      setOriginFeature(null);
      setDestFeature(null);
      setShowNotes(false);
      setTab('current');
      invalidate(updated);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo crear la entrega.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const openEdit = (stop: RunStop) => {
    editForm.reset(stopToForm(stop));
    setEditingStop(stop);
    setEditOriginFeature(null);
    setEditDestFeature(null);
  };

  const handleRemove = (stop: RunStop) => {
    Alert.alert('Eliminar parada', `¿Eliminar "${stop.address || stop.id.slice(-6).toUpperCase()}" del run?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeMutation.mutate(stop.id) },
    ]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleClose = () => {
    setTab('current'); setAddMode('existing'); setEditingStop(null); setSelectedIds(new Set());
    setOriginFeature(null); setDestFeature(null);
    setEditOriginFeature(null); setEditDestFeature(null);
    setShowNotes(false); newForm.reset(); onClose();
  };

  const sortedStops = [...(run.stops ?? [])].sort((a, b) => a.sequence - b.sequence);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
      <View className="flex-1 bg-surface-secondary" style={{ paddingTop: insets.top }}>

        {/* Header */}
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-border">
          <TouchableOpacity
            onPress={editingStop ? () => setEditingStop(null) : handleClose}
            className="w-9 h-9 bg-surface-secondary rounded-full items-center justify-center mr-3"
          >
            <Text className="text-text-primary text-lg">←</Text>
          </TouchableOpacity>
          <Text className="text-text-primary text-lg font-bold flex-1" style={{ fontFamily: 'Inter_700Bold' }}>
            {editingStop ? 'Editar parada' : 'Modificar paradas'}
          </Text>
        </View>

        {/* ══ EDIT MODE ══════════════════════════════════════════ */}
        {editingStop && (
          <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View className="flex-row items-center bg-primary-50 border border-primary-200 rounded-2xl px-4 py-3 mb-5">
                <Text className="text-primary-600 text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
                  Editando — {editingStop.trackingCode ?? editingStop.id.slice(-8).toUpperCase()}
                </Text>
              </View>
              <View style={{ gap: 16 }}>

                {/* Origin address */}
                <View>
                  <Controller
                    control={editForm.control}
                    name="originAddress"
                    render={({ field: { onChange, value } }) => (
                      <AddressSearchInput
                        label={isPassenger ? 'Punto de recogida' : 'Origen (dirección de recogida)'}
                        placeholder="Buscar dirección de origen..."
                        initialValue={value ?? ''}
                        onSelect={(feature) => {
                          onChange(feature.formatted);
                          setEditOriginFeature(feature);
                        }}
                      />
                    )}
                  />
                  {editOriginFeature && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#2563eb', flex: 1 }} numberOfLines={1}>
                        🌐 {editOriginFeature.coordinates.lat.toFixed(5)}, {editOriginFeature.coordinates.lng.toFixed(5)}
                      </Text>
                      <TouchableOpacity onPress={() => { setEditOriginFeature(null); editForm.setValue('originAddress', ''); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close" size={14} color="#2563eb" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Destination address */}
                <View>
                  <Controller
                    control={editForm.control}
                    name="destinationAddress"
                    render={({ field: { onChange, value } }) => (
                      <AddressSearchInput
                        label={isPassenger ? 'Punto de destino *' : 'Destino (dirección de entrega) *'}
                        placeholder="Buscar dirección de destino..."
                        initialValue={value ?? ''}
                        onSelect={(feature) => {
                          onChange(feature.formatted);
                          setEditDestFeature(feature);
                        }}
                      />
                    )}
                  />
                  {editForm.formState.errors.destinationAddress && (
                    <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontFamily: 'Inter_400Regular' }}>
                      {editForm.formState.errors.destinationAddress.message}
                    </Text>
                  )}
                  {editDestFeature && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#16a34a', flex: 1 }} numberOfLines={1}>
                        🌐 {editDestFeature.coordinates.lat.toFixed(5)}, {editDestFeature.coordinates.lng.toFixed(5)}
                      </Text>
                      <TouchableOpacity onPress={() => { setEditDestFeature(null); editForm.setValue('destinationAddress', ''); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close" size={14} color="#16a34a" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Description */}
                <Controller
                  control={editForm.control}
                  name="description"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label={isPassenger ? 'Nombre del pasajero *' : 'Descripción del envío *'}
                      placeholder={isPassenger ? 'Ej. Juan García' : 'Cajas, documentos, etc.'}
                      autoCapitalize="sentences"
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value ?? ''}
                      error={editForm.formState.errors.description?.message}
                    />
                  )}
                />

                {/* Contact */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Controller
                      control={editForm.control}
                      name="destinationContactName"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label={isPassenger ? 'Responsable en destino' : 'Contacto destino'}
                          placeholder="Nombre"
                          autoCapitalize="words"
                          onChangeText={onChange}
                          onBlur={onBlur}
                          value={value ?? ''}
                        />
                      )}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Controller
                      control={editForm.control}
                      name="destinationContactPhone"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label="Teléfono"
                          placeholder="+1 555 0000"
                          keyboardType="phone-pad"
                          onChangeText={onChange}
                          onBlur={onBlur}
                          value={value ?? ''}
                        />
                      )}
                    />
                  </View>
                </View>

                {/* Reference number */}
                <Controller
                  control={editForm.control}
                  name="referenceNumber"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="N° referencia"
                      placeholder="OC-2024-001"
                      autoCapitalize="characters"
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value ?? ''}
                    />
                  )}
                />

                {/* Notes */}
                <Controller
                  control={editForm.control}
                  name="notes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Notas"
                      placeholder="Instrucciones especiales..."
                      autoCapitalize="sentences"
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value ?? ''}
                    />
                  )}
                />

                <Button fullWidth size="lg" loading={editMutation.isPending} onPress={editForm.handleSubmit((v) => editMutation.mutate({ id: editingStop.id, values: v }))} className="mt-2">
                  Guardar cambios
                </Button>
                <Button fullWidth variant="ghost" size="md" onPress={() => setEditingStop(null)}>Cancelar</Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ══ NORMAL MODE ════════════════════════════════════════ */}
        {!editingStop && (
          <>
            {/* Tabs */}
            <View className="flex-row bg-white border-b border-border px-4">
              {(['current', 'add'] as Tab[]).map((t) => (
                <TouchableOpacity key={t} onPress={() => setTab(t)} className={`mr-6 pb-3 border-b-2 ${tab === t ? 'border-primary-500' : 'border-transparent'}`}>
                  <Text className={`text-sm font-medium ${tab === t ? 'text-primary-600' : 'text-text-muted'}`} style={{ fontFamily: 'Inter_500Medium' }}>
                    {t === 'current' ? `Paradas (${sortedStops.length})` : 'Agregar'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Current stops ── */}
            {tab === 'current' && (
              <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 pb-10" showsVerticalScrollIndicator={false}>
                {sortedStops.length === 0 ? (
                  <View className="items-center py-16">
                    <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>Este run no tiene paradas aún.</Text>
                    <TouchableOpacity onPress={() => setTab('add')} className="mt-3">
                      <Text className="text-primary-600 text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }}>Agregar primera entrega →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  sortedStops.map((stop, index) => (
                    <View key={stop.id} className="flex-row items-center bg-white border border-border rounded-2xl px-4 py-3 mb-2">
                      <View className="w-7 h-7 bg-surface-secondary rounded-full items-center justify-center mr-3">
                        <Text className="text-xs font-semibold text-text-secondary" style={{ fontFamily: 'Inter_600SemiBold' }}>{index + 1}</Text>
                      </View>
                      <View className="flex-1 mr-2">
                        <Text className="text-text-primary text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }} numberOfLines={1}>
                          {stop.address || stop.trackingCode || stop.id.slice(-8).toUpperCase()}
                        </Text>
                        {(stop.trackingCode || stop.referenceNumber) && (
                          <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                            {stop.trackingCode ?? stop.referenceNumber}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => openEdit(stop)} className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center mr-1.5">
                        <Text className="text-blue-500 text-sm">✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleRemove(stop)} disabled={removeMutation.isPending} className="w-8 h-8 bg-red-50 rounded-full items-center justify-center">
                        {removingId === stop.id ? <ActivityIndicator size="small" color="#ef4444" /> : <Text className="text-red-500 text-lg leading-none">−</Text>}
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            {/* ── Add tab ── */}
            {tab === 'add' && (
              <View className="flex-1">
                {/* Sub-selector */}
                <View className="flex-row bg-surface-secondary mx-4 mt-4 rounded-xl p-1 mb-4">
                  <TouchableOpacity
                    onPress={() => setAddMode('existing')}
                    activeOpacity={0.8}
                    className="flex-1 py-2 rounded-lg items-center"
                    style={addMode === 'existing' ? { backgroundColor: 'white', elevation: 1 } : undefined}
                  >
                    <Text className={`text-sm font-medium ${addMode === 'existing' ? 'text-text-primary' : 'text-text-muted'}`} style={{ fontFamily: 'Inter_500Medium' }}>
                      Existentes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAddMode('new')}
                    activeOpacity={0.8}
                    className="flex-1 py-2 rounded-lg items-center"
                    style={addMode === 'new' ? { backgroundColor: 'white', elevation: 1 } : undefined}
                  >
                    <Text className={`text-sm font-medium ${addMode === 'new' ? 'text-text-primary' : 'text-text-muted'}`} style={{ fontFamily: 'Inter_500Medium' }}>
                      Nuevo
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Existing shipments */}
                {addMode === 'existing' && (
                  <View className="flex-1">
                    {loadingShipments ? (
                      <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color="#22c55e" />
                        <Text className="text-text-muted text-sm mt-3" style={{ fontFamily: 'Inter_400Regular' }}>Cargando entregas disponibles...</Text>
                      </View>
                    ) : (
                      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-32" showsVerticalScrollIndicator={false}>
                        {(availableShipments ?? []).length === 0 ? (
                          <View className="items-center py-16">
                            <Text className="text-text-muted text-sm text-center" style={{ fontFamily: 'Inter_400Regular' }}>No hay entregas confirmadas disponibles.{'\n'}Crea una nueva desde "Nuevo".</Text>
                          </View>
                        ) : (
                          (availableShipments ?? []).map((shipment: Shipment) => {
                            const selected = selectedIds.has(shipment.id);
                            return (
                              <TouchableOpacity key={shipment.id} onPress={() => toggleSelect(shipment.id)} activeOpacity={0.75} className={`flex-row items-center border rounded-2xl px-4 py-3 mb-2 ${selected ? 'bg-primary-50 border-primary-400' : 'bg-white border-border'}`}>
                                <View className={`w-5 h-5 rounded border mr-3 items-center justify-center ${selected ? 'bg-primary-500 border-primary-500' : 'border-border bg-white'}`}>
                                  {selected && <Text className="text-white text-xs font-bold">✓</Text>}
                                </View>
                                <View className="flex-1">
                                  <Text className="text-text-primary text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }} numberOfLines={1}>{shipment.destinationAddress}</Text>
                                  <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>{shipment.trackingCode}{shipment.referenceNumber ? ` · ${shipment.referenceNumber}` : ''}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </ScrollView>
                    )}
                    {selectedIds.size > 0 && (
                      <View className="absolute bottom-0 left-0 right-0 bg-white px-4 pt-3 pb-8 border-t border-border">
                        <Button fullWidth size="lg" loading={addExistingMutation.isPending} onPress={() => addExistingMutation.mutate(Array.from(selectedIds))}>
                          Agregar {selectedIds.size} entrega{selectedIds.size !== 1 ? 's' : ''}
                        </Button>
                      </View>
                    )}
                  </View>
                )}

                {/* New shipment form */}
                {addMode === 'new' && (
                  <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                      <View style={{ gap: 16 }}>

                        {/* Origin address */}
                        <View>
                          <Controller
                            control={newForm.control}
                            name="originAddress"
                            render={({ field: { onChange, value } }) => (
                              <AddressSearchInput
                                label={isPassenger ? 'Punto de recogida' : 'Origen (dirección de recogida)'}
                                placeholder="Buscar dirección de origen..."
                                initialValue={value}
                                onSelect={(feature) => {
                                  onChange(feature.formatted);
                                  setOriginFeature(feature);
                                }}
                              />
                            )}
                          />
                          {originFeature && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#2563eb', flex: 1 }} numberOfLines={1}>
                                🌐 {originFeature.coordinates.lat.toFixed(5)}, {originFeature.coordinates.lng.toFixed(5)}
                              </Text>
                              <TouchableOpacity onPress={() => { setOriginFeature(null); newForm.setValue('originAddress', ''); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Ionicons name="close" size={14} color="#2563eb" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* Destination address */}
                        <View>
                          <Controller
                            control={newForm.control}
                            name="destinationAddress"
                            render={({ field: { onChange, value } }) => (
                              <AddressSearchInput
                                label={isPassenger ? 'Punto de destino *' : 'Destino (dirección de entrega) *'}
                                placeholder="Buscar dirección de destino..."
                                initialValue={value}
                                onSelect={(feature) => {
                                  onChange(feature.formatted);
                                  setDestFeature(feature);
                                }}
                              />
                            )}
                          />
                          {newForm.formState.errors.destinationAddress && (
                            <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontFamily: 'Inter_400Regular' }}>
                              {newForm.formState.errors.destinationAddress.message}
                            </Text>
                          )}
                          {destFeature && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#16a34a', flex: 1 }} numberOfLines={1}>
                                🌐 {destFeature.coordinates.lat.toFixed(5)}, {destFeature.coordinates.lng.toFixed(5)}
                              </Text>
                              <TouchableOpacity onPress={() => { setDestFeature(null); newForm.setValue('destinationAddress', ''); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Ionicons name="close" size={14} color="#16a34a" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* Description */}
                        <Controller
                          control={newForm.control}
                          name="description"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                              label={isPassenger ? 'Nombre del pasajero *' : 'Descripción de la carga *'}
                              placeholder={isPassenger ? 'Ej. Juan García' : 'Ej. Pallets de electrónica, cajas, etc.'}
                              autoCapitalize="sentences"
                              onChangeText={onChange}
                              onBlur={onBlur}
                              value={value}
                              error={newForm.formState.errors.description?.message}
                            />
                          )}
                        />

                        {/* Reference + Cargo type (freight only) */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: isPassenger ? 1 : 1 }}>
                            <Controller
                              control={newForm.control}
                              name="referenceNumber"
                              render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                  label="N° referencia"
                                  placeholder="PO-12345"
                                  autoCapitalize="characters"
                                  onChangeText={onChange}
                                  onBlur={onBlur}
                                  value={value ?? ''}
                                />
                              )}
                            />
                          </View>
                          {!isPassenger && (
                            <View style={{ flex: 1.5 }}>
                              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569', marginBottom: 6 }}>Tipo de carga</Text>
                              <Controller
                                control={newForm.control}
                                name="cargoType"
                                render={({ field: { onChange, value } }) => (
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                      {CARGO_TYPES.map((ct) => {
                                        const active = value === ct.value;
                                        return (
                                          <TouchableOpacity
                                            key={ct.value}
                                            onPress={() => onChange(active ? undefined : ct.value)}
                                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: active ? '#22c55e' : '#e2e8f0', backgroundColor: active ? '#f0fdf4' : '#fff' }}
                                          >
                                            <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: active ? '#16a34a' : '#64748b' }}>{ct.label}</Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  </ScrollView>
                                )}
                              />
                            </View>
                          )}
                        </View>

                        {/* Weight + Pieces (freight only) */}
                        {!isPassenger && (
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                              <Controller
                                control={newForm.control}
                                name="weightKg"
                                render={({ field: { onChange, onBlur, value } }) => (
                                  <Input
                                    label="Peso (kg)"
                                    placeholder="1500.00"
                                    keyboardType="decimal-pad"
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    value={value ?? ''}
                                    error={newForm.formState.errors.weightKg?.message}
                                  />
                                )}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Controller
                                control={newForm.control}
                                name="pieces"
                                render={({ field: { onChange, onBlur, value } }) => (
                                  <Input
                                    label="Piezas"
                                    placeholder="24"
                                    keyboardType="number-pad"
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    value={value ?? ''}
                                    error={newForm.formState.errors.pieces?.message}
                                  />
                                )}
                              />
                            </View>
                          </View>
                        )}

                        {/* Contact */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Controller
                              control={newForm.control}
                              name="destinationContactName"
                              render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                  label={isPassenger ? 'Responsable en destino' : 'Contacto destino'}
                                  placeholder="Nombre"
                                  autoCapitalize="words"
                                  onChangeText={onChange}
                                  onBlur={onBlur}
                                  value={value ?? ''}
                                />
                              )}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Controller
                              control={newForm.control}
                              name="destinationContactPhone"
                              render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                  label="Teléfono"
                                  placeholder="+1 555 0000"
                                  keyboardType="phone-pad"
                                  onChangeText={onChange}
                                  onBlur={onBlur}
                                  value={value ?? ''}
                                />
                              )}
                            />
                          </View>
                        </View>

                        {/* Notes toggle */}
                        <TouchableOpacity
                          onPress={() => setShowNotes((p) => !p)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={showNotes ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" />
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: '#94a3b8' }}>
                            {showNotes ? 'Ocultar notas' : 'Agregar notas'}
                          </Text>
                        </TouchableOpacity>

                        {showNotes && (
                          <Controller
                            control={newForm.control}
                            name="notes"
                            render={({ field: { onChange, onBlur, value } }) => (
                              <Input
                                label="Notas internas"
                                placeholder="Instrucciones especiales de entrega..."
                                autoCapitalize="sentences"
                                onChangeText={onChange}
                                onBlur={onBlur}
                                value={value ?? ''}
                              />
                            )}
                          />
                        )}

                        <Button fullWidth size="lg" loading={createMutation.isPending} onPress={newForm.handleSubmit((v) => createMutation.mutate(v))} className="mt-2">
                          Crear y agregar al run
                        </Button>
                      </View>
                    </ScrollView>
                  </KeyboardAvoidingView>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}
