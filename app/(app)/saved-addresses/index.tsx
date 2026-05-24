import { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { SavedAddressesService } from '../../../src/services/api/saved-addresses.service';
import { AddressSearchInput } from '../../../src/components/common/AddressSearchInput';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import type { GeocodeFeature, SavedAddress, SavedAddressKind } from '../../../src/types';

// ─── Kind config ──────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<SavedAddressKind | 'all', { label: string; icon: string }> = {
  all:      { label: 'Todos',    icon: '🗂' },
  depot:    { label: 'Depósito', icon: '🏭' },
  customer: { label: 'Cliente',  icon: '👤' },
  dropoff:  { label: 'Entrega',  icon: '📥' },
  pickup:   { label: 'Recogida', icon: '📤' },
  other:    { label: 'Otro',     icon: '📍' },
};

const KIND_OPTIONS: SavedAddressKind[] = ['depot', 'customer', 'dropoff', 'pickup', 'other'];

// ─── Create form schema ───────────────────────────────────────────────────────

const createSchema = z.object({
  label: z.string().min(1, 'Requerido').max(120, 'Máx 120 caracteres'),
  kind:  z.enum(['depot', 'customer', 'dropoff', 'pickup', 'other']).optional(),
  notes: z.string().max(2000).optional(),
});

type CreateForm = z.infer<typeof createSchema>;

// ─── Create sheet ─────────────────────────────────────────────────────────────

function CreateAddressSheet({
  sheetRef,
  isSaving,
  onSave,
}: {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  isSaving: boolean;
  onSave: (form: CreateForm, feature: GeocodeFeature) => void;
}) {
  const [feature, setFeature] = useState<GeocodeFeature | null>(null);
  const [addressError, setAddressError] = useState('');

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { label: '', kind: undefined, notes: '' },
  });

  const selectedKind = watch('kind');

  const handleSave = (values: CreateForm) => {
    if (!feature) {
      setAddressError('Selecciona una dirección de las sugerencias');
      return;
    }
    onSave(values, feature);
    reset();
    setFeature(null);
    setAddressError('');
  };

  const handleAddressSelect = (f: GeocodeFeature) => {
    setFeature(f);
    setAddressError('');
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['75%', '95%']}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
      backgroundStyle={{ backgroundColor: '#fff' }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, paddingTop: 4 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-text-primary text-base font-bold mb-1" style={{ fontFamily: 'Inter_700Bold' }}>
          Nueva dirección guardada
        </Text>
        <Text className="text-text-muted text-xs mb-5" style={{ fontFamily: 'Inter_400Regular' }}>
          Guarda ubicaciones frecuentes para usarlas rápidamente al crear envíos.
        </Text>

        {/* Label */}
        <View className="mb-4">
          <Controller
            control={control}
            name="label"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nombre del lugar"
                placeholder="Ej. Bodega Central, Cliente Pérez"
                autoCapitalize="words"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.label?.message}
              />
            )}
          />
        </View>

        {/* Address autocomplete */}
        <View className="mb-1">
          <AddressSearchInput
            label="Dirección"
            placeholder="Buscar dirección..."
            onSelect={handleAddressSelect}
          />
          {addressError ? (
            <Text className="text-red-500 text-xs mt-1" style={{ fontFamily: 'Inter_400Regular' }}>
              {addressError}
            </Text>
          ) : null}
        </View>

        {/* Coordinates badge — shown once a feature is selected */}
        {feature && (
          <View className="flex-row items-center bg-primary-50 border border-primary-100 rounded-xl px-3 py-2 mb-4 gap-x-2">
            <Text className="text-primary-500">📌</Text>
            <Text className="text-primary-700 text-xs flex-1" style={{ fontFamily: 'Inter_400Regular' }}>
              {feature.coordinates.lat.toFixed(5)}, {feature.coordinates.lng.toFixed(5)}
            </Text>
            <TouchableOpacity onPress={() => setFeature(null)}>
              <Text className="text-primary-400 text-xs">✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Kind selector */}
        <View className="mb-4 mt-2">
          <Text className="text-sm text-text-secondary mb-2" style={{ fontFamily: 'Inter_500Medium' }}>
            Categoría (opcional)
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

        {/* Notes */}
        <View className="mb-6">
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Instrucciones / Notas (opcional)"
                placeholder="Ej. Tocar timbre, horario 9-18hs"
                multiline
                numberOfLines={3}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.notes?.message}
              />
            )}
          />
        </View>

        <Button fullWidth loading={isSaving} onPress={handleSubmit(handleSave)}>
          Guardar dirección
        </Button>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Address card ─────────────────────────────────────────────────────────────

function AddressCard({ address, onPress }: { address: SavedAddress; onPress: () => void }) {
  const kind = KIND_CONFIG[address.kind] ?? KIND_CONFIG.other;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="bg-white rounded-2xl border border-border p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-1.5">
        <Text
          className="text-text-primary font-semibold flex-1 mr-2"
          numberOfLines={1}
          style={{ fontFamily: 'Inter_600SemiBold' }}
        >
          {address.label}
        </Text>
        <View className="flex-row items-center bg-surface-secondary rounded-full px-2.5 py-0.5">
          <Text className="text-xs mr-1">{kind.icon}</Text>
          <Text className="text-text-secondary text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            {kind.label}
          </Text>
        </View>
      </View>

      <Text
        className="text-text-secondary text-sm mb-2"
        numberOfLines={2}
        style={{ fontFamily: 'Inter_400Regular' }}
      >
        {address.formatted}
      </Text>

      {address.notes && (
        <View className="flex-row items-start bg-amber-50 rounded-xl px-3 py-2">
          <Text className="text-sm mr-1.5 mt-0.5">📝</Text>
          <Text
            className="text-amber-800 text-xs flex-1"
            numberOfLines={2}
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {address.notes}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Skeleton list ────────────────────────────────────────────────────────────

function AddressListSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} className="bg-white rounded-2xl border border-border p-4 mb-3">
          <Skeleton className="h-5 w-3/5 rounded-lg mb-2" />
          <Skeleton className="h-4 w-full rounded-lg mb-1" />
          <Skeleton className="h-4 w-4/5 rounded-lg" />
        </View>
      ))}
    </>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SavedAddressesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createSheetRef = useRef<BottomSheetModalMethods>(null);
  const [search, setSearch] = useState('');
  const [activeKind, setActiveKind] = useState<SavedAddressKind | 'all'>('all');

  const queryParams = {
    q:     search.trim().length >= 2 ? search.trim() : undefined,
    kind:  activeKind !== 'all' ? activeKind : undefined,
    limit: 50,
  };

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['saved-addresses', queryParams],
    queryFn:  () => SavedAddressesService.getAll(queryParams),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: ({ form, feature }: { form: CreateForm; feature: GeocodeFeature }) =>
      SavedAddressesService.create({
        label:     form.label,
        kind:      form.kind,
        notes:     form.notes || undefined,
        formatted: feature.formatted,
        lat:       feature.coordinates.lat,
        lng:       feature.coordinates.lng,
        placeId:   feature.placeId,
        country:   feature.country,
        region:    feature.region,
        locality:  feature.locality,
        postcode:  feature.postcode,
      }),
    onSuccess: () => {
      createSheetRef.current?.dismiss();
      queryClient.invalidateQueries({ queryKey: ['saved-addresses'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo guardar la dirección.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const addresses = data?.data ?? [];

  const handleCardPress = useCallback((address: SavedAddress) => {
    router.push(`/(app)/saved-addresses/${address.id}` as any);
  }, [router]);

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
        <Text className="flex-1 text-text-primary text-lg font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
          Direcciones guardadas
        </Text>
        <TouchableOpacity
          onPress={() => createSheetRef.current?.present()}
          className="flex-row items-center bg-primary-500 rounded-xl px-3 py-2 gap-x-1.5"
          activeOpacity={0.8}
        >
          <Text className="text-white text-base leading-none">+</Text>
          <Text className="text-white text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
            Nueva
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View className="px-4 pt-4 pb-2 bg-white border-b border-border">
        <View className="flex-row items-center bg-surface-secondary rounded-xl px-3 h-11 border border-border">
          <Text className="text-base mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-text-primary text-sm"
            style={{ fontFamily: 'Inter_400Regular' }}
            placeholder="Buscar por nombre o dirección..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text className="text-text-muted">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Kind filter pills */}
      <View className="bg-white pb-3 border-b border-border">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-4 gap-x-2 pt-2"
        >
          {(Object.keys(KIND_CONFIG) as (SavedAddressKind | 'all')[]).map((k) => {
            const cfg = KIND_CONFIG[k];
            const isActive = activeKind === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setActiveKind(k)}
                className={`flex-row items-center px-3 py-1.5 rounded-full border ${
                  isActive ? 'bg-primary-500 border-primary-500' : 'bg-white border-border'
                }`}
              >
                <Text className="text-sm mr-1">{cfg.icon}</Text>
                <Text
                  className={`text-xs font-medium ${isActive ? 'text-white' : 'text-text-secondary'}`}
                  style={{ fontFamily: 'Inter_500Medium' }}
                >
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {isLoading ? (
        <View className="px-4 pt-4">
          <AddressListSkeleton />
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pt-4 pb-8"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <EmptyState
              icon="📍"
              title={search.length >= 2 ? 'Sin resultados' : 'Sin direcciones guardadas'}
              description={
                search.length >= 2
                  ? `No se encontraron favoritos para "${search}"`
                  : 'Guarda ubicaciones frecuentes para usarlas rápidamente.'
              }
            />
          }
          ListHeaderComponent={
            addresses.length > 0 ? (
              <Text className="text-text-muted text-xs mb-3" style={{ fontFamily: 'Inter_400Regular' }}>
                {addresses.length} dirección{addresses.length !== 1 ? 'es' : ''}
                {activeKind !== 'all' ? ` · ${KIND_CONFIG[activeKind].label}` : ''}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <AddressCard address={item} onPress={() => handleCardPress(item)} />
          )}
        />
      )}

      <CreateAddressSheet
        sheetRef={createSheetRef}
        isSaving={createMutation.isPending}
        onSave={(form, feature) => createMutation.mutate({ form, feature })}
      />
    </SafeAreaView>
  );
}
