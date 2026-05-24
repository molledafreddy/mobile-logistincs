import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Linking, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SavedAddressesService } from '../../../src/services/api/saved-addresses.service';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { AddressSearchInput } from '../../../src/components/common/AddressSearchInput';
import type { SavedAddressKind, GeocodeFeature } from '../../../src/types';

const KIND_CONFIG: Record<SavedAddressKind, { label: string; icon: string; color: string }> = {
  depot:    { label: 'Depósito', icon: '🏭', color: 'bg-blue-100 text-blue-700' },
  customer: { label: 'Cliente',  icon: '👤', color: 'bg-purple-100 text-purple-700' },
  dropoff:  { label: 'Entrega',  icon: '📥', color: 'bg-green-100 text-green-700' },
  pickup:   { label: 'Recogida', icon: '📤', color: 'bg-orange-100 text-orange-700' },
  other:    { label: 'Otro',     icon: '📍', color: 'bg-slate-100 text-slate-700' },
};

const KIND_OPTIONS: SavedAddressKind[] = ['depot', 'customer', 'dropoff', 'pickup', 'other'];

// ─── Edit schema ──────────────────────────────────────────────────────────────

const editSchema = z.object({
  label: z.string().min(1, 'Requerido').max(120),
  kind:  z.enum(['depot', 'customer', 'dropoff', 'pickup', 'other']).optional(),
  notes: z.string().max(2000).optional(),
});

type EditForm = z.infer<typeof editSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <View className="py-3 border-b border-border">
      <Text className="text-xs text-text-muted mb-1" style={{ fontFamily: 'Inter_400Regular' }}>
        {icon}  {label}
      </Text>
      {children}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SavedAddressDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<GeocodeFeature | null>(null);

  const { data: address, isLoading } = useQuery({
    queryKey: ['saved-addresses', id],
    queryFn: () => SavedAddressesService.getById(id),
    staleTime: 60_000,
  });

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: address
      ? {
          label: address.label,
          kind:  address.kind,
          notes: address.notes ?? '',
        }
      : undefined,
  });

  const selectedKind = watch('kind');

  const updateMutation = useMutation({
    mutationFn: (values: EditForm) =>
      SavedAddressesService.update(id, {
        label:     values.label,
        kind:      values.kind,
        notes:     values.notes || undefined,
        ...(selectedFeature
          ? {
              formatted: selectedFeature.formatted,
              lat:       selectedFeature.coordinates.lat,
              lng:       selectedFeature.coordinates.lng,
              locality:  selectedFeature.locality,
              region:    selectedFeature.region,
              postcode:  selectedFeature.postcode,
              country:   selectedFeature.country,
            }
          : {}),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['saved-addresses', id], updated);
      queryClient.invalidateQueries({ queryKey: ['saved-addresses'] });
      setIsEditing(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo actualizar la dirección.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => SavedAddressesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-addresses'] });
      router.back();
    },
    onError: () => Alert.alert('Error', 'No se pudo eliminar la dirección.'),
  });

  const handleDelete = () => {
    Alert.alert(
      'Eliminar dirección',
      `¿Eliminar "${address?.label}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  };

  const openInMaps = () => {
    if (!address) return;
    const lat = parseFloat(address.lat);
    const lng = parseFloat(address.lng);
    if (!lat && !lng) { Alert.alert('Sin coordenadas', 'Esta dirección no tiene coordenadas registradas.'); return; }
    const label = encodeURIComponent(address.label);
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}(${label})`).catch(() =>
      Alert.alert('Error', 'No se pudo abrir el mapa.')
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-secondary items-center justify-center">
        <Text className="text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>Cargando...</Text>
      </SafeAreaView>
    );
  }

  if (!address) {
    return (
      <SafeAreaView className="flex-1 bg-surface-secondary items-center justify-center px-8">
        <Text className="text-2xl mb-3">😕</Text>
        <Text className="text-text-primary font-semibold text-center mb-1" style={{ fontFamily: 'Inter_600SemiBold' }}>
          Dirección no encontrada
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary-600 text-sm" style={{ fontFamily: 'Inter_500Medium' }}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const kind = KIND_CONFIG[address.kind] ?? KIND_CONFIG.other;

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-border bg-white">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 bg-surface-secondary rounded-full items-center justify-center border border-border mr-3"
        >
          <Text className="text-text-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-text-primary text-lg font-bold" numberOfLines={1} style={{ fontFamily: 'Inter_700Bold' }}>
          {address.label}
        </Text>
        {!isEditing && (
          <View className="flex-row items-center gap-x-2">
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              className="w-9 h-9 bg-primary-50 rounded-full items-center justify-center border border-primary-200"
            >
              <Text className="text-base">✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-200"
            >
              <Text className="text-base">🗑</Text>
            </TouchableOpacity>
          </View>
        )}
        {!isEditing && (
          <View className={`flex-row items-center rounded-full px-2.5 py-1 ml-2 ${kind.color.split(' ')[0]}`}>
            <Text className="text-xs mr-1">{kind.icon}</Text>
            <Text className={`text-xs font-medium ${kind.color.split(' ')[1]}`} style={{ fontFamily: 'Inter_500Medium' }}>
              {kind.label}
            </Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-4 pb-10"
          keyboardShouldPersistTaps="handled"
        >

          {/* ── View mode ── */}
          {!isEditing && (
            <>
              <View className="bg-white rounded-2xl border border-border px-4 mb-4">
                <DetailRow icon="📍" label="Dirección">
                  <Text className="text-text-primary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                    {address.formatted}
                  </Text>
                </DetailRow>

                {address.locality && (
                  <DetailRow icon="🏙" label="Localidad / Ciudad">
                    <Text className="text-text-primary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                      {[address.locality, address.region].filter(Boolean).join(', ')}
                    </Text>
                  </DetailRow>
                )}

                {address.postcode && (
                  <DetailRow icon="📮" label="Código postal">
                    <Text className="text-text-primary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                      {address.postcode}
                    </Text>
                  </DetailRow>
                )}

                <View className="py-3">
                  <Text className="text-xs text-text-muted mb-1" style={{ fontFamily: 'Inter_400Regular' }}>
                    🌐  Coordenadas
                  </Text>
                  <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                    {parseFloat(address.lat).toFixed(6)}, {parseFloat(address.lng).toFixed(6)}
                  </Text>
                </View>
              </View>

              {address.notes && (
                <View className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 mb-4">
                  <Text className="text-xs text-amber-700 font-semibold mb-2" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    📝  Instrucciones / Notas
                  </Text>
                  <Text className="text-amber-900 text-sm leading-5" style={{ fontFamily: 'Inter_400Regular' }}>
                    {address.notes}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={openInMaps}
                className="flex-row items-center justify-center bg-primary-500 rounded-2xl py-4 gap-x-2"
                activeOpacity={0.8}
              >
                <Text className="text-white text-base">🗺</Text>
                <Text className="text-white font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Abrir en Maps
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Edit mode ── */}
          {isEditing && (
            <Card>
              <Text className="text-text-primary font-semibold mb-4" style={{ fontFamily: 'Inter_600SemiBold' }}>
                Editar dirección
              </Text>

              <View className="mb-4">
                <Controller
                  control={control}
                  name="label"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input label="Nombre del lugar" onChangeText={onChange} onBlur={onBlur} value={value} error={errors.label?.message} />
                  )}
                />
              </View>

              {/* Address autocomplete */}
              <View className="mb-4">
                <Text className="text-sm text-text-secondary mb-1.5" style={{ fontFamily: 'Inter_500Medium' }}>
                  Dirección
                </Text>
                <AddressSearchInput
                  initialValue={address.formatted}
                  onSelect={(feature) => setSelectedFeature(feature)}
                  placeholder="Buscar dirección..."
                />
                {selectedFeature && (
                  <View className="flex-row items-center justify-between mt-2 bg-primary-50 border border-primary-200 rounded-xl px-3 py-2">
                    <Text className="text-xs text-primary-700 flex-1 mr-2" style={{ fontFamily: 'Inter_400Regular' }} numberOfLines={1}>
                      🌐 {selectedFeature.coordinates.lat.toFixed(6)}, {selectedFeature.coordinates.lng.toFixed(6)}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedFeature(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text className="text-primary-500 text-base">✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Kind selector */}
              <View className="mb-4">
                <Text className="text-sm text-text-secondary mb-2" style={{ fontFamily: 'Inter_500Medium' }}>
                  Categoría
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {KIND_OPTIONS.map((k) => {
                    const cfg = KIND_CONFIG[k];
                    const isActive = selectedKind === k;
                    return (
                      <Controller
                        key={k}
                        control={control}
                        name="kind"
                        render={({ field: { onChange, value } }) => (
                          <TouchableOpacity
                            onPress={() => onChange(value === k ? undefined : k)}
                            activeOpacity={0.75}
                            className={`flex-row items-center px-3 py-2 rounded-xl border ${
                              isActive ? 'bg-primary-50 border-primary-400' : 'bg-white border-border'
                            }`}
                          >
                            <Text className="text-base mr-1.5">{cfg.icon}</Text>
                            <Text
                              className={`text-xs font-medium ${isActive ? 'text-primary-700' : 'text-text-secondary'}`}
                              style={{ fontFamily: 'Inter_500Medium' }}
                            >
                              {cfg.label}
                            </Text>
                          </TouchableOpacity>
                        )}
                      />
                    );
                  })}
                </View>
              </View>

              <View className="mb-6">
                <Controller
                  control={control}
                  name="notes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input label="Notas (opcional)" multiline numberOfLines={3} onChangeText={onChange} onBlur={onBlur} value={value} error={errors.notes?.message} />
                  )}
                />
              </View>

              <View className="flex-row gap-x-3">
                <View className="flex-1">
                  <Button variant="outline" fullWidth onPress={() => { reset(); setSelectedFeature(null); setIsEditing(false); }}>
                    Cancelar
                  </Button>
                </View>
                <View className="flex-1">
                  <Button fullWidth loading={updateMutation.isPending} onPress={handleSubmit((v) => updateMutation.mutate(v))}>
                    Guardar
                  </Button>
                </View>
              </View>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
