import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrucksService } from '../../src/services/api/trucks.service';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useAuthStore } from '../../src/stores/auth.store';
import type { Truck, TruckStatus, TruckType } from '../../src/types';

// ─── Config ───────────────────────────────────────────────────────────────────

const TRUCK_TYPES: { value: TruckType; label: string; icon: string }[] = [
  { value: 'box',      label: 'Caja',       icon: '📦' },
  { value: 'flatbed',  label: 'Plataforma', icon: '🚛' },
  { value: 'dry-van',  label: 'Dry Van',    icon: '🚚' },
  { value: 'reefer',   label: 'Refrigerado',icon: '❄️' },
  { value: 'tanker',   label: 'Tanque',     icon: '🛢' },
  { value: 'other',    label: 'Otro',       icon: '🚐' },
];

const STATUS_CONFIG: Record<TruckStatus, { label: string; color: string; dot: string }> = {
  available:      { label: 'Disponible',         color: 'bg-green-100 border-green-400',  dot: 'bg-green-500' },
  in_transit:     { label: 'En tránsito',        color: 'bg-blue-100 border-blue-400',   dot: 'bg-blue-500'  },
  maintenance:    { label: 'En mantenimiento',   color: 'bg-amber-100 border-amber-400', dot: 'bg-amber-500' },
  out_of_service: { label: 'Fuera de servicio',  color: 'bg-red-100 border-red-400',     dot: 'bg-red-500'   },
};

const EDITABLE_STATUSES: TruckStatus[] = ['available', 'maintenance', 'out_of_service'];

// ─── Shared form schema ───────────────────────────────────────────────────────

const truckSchema = z.object({
  plate: z.string().min(2, 'Mínimo 2 caracteres').max(20, 'Máximo 20 caracteres').toUpperCase(),
  make:  z.string().max(50).optional(),
  model: z.string().max(50).optional(),
  year:  z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= 2100),
      'Año inválido (1950–2100)',
    ),
  type:        z.enum(['flatbed', 'reefer', 'dry-van', 'tanker', 'box', 'other']).optional(),
  capacityKg:  z.string().optional().refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'Capacidad inválida'),
  odometerKm:  z.string().optional().refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'Odómetro inválido'),
  notes:       z.string().max(500).optional(),
});

type TruckForm = z.infer<typeof truckSchema>;

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-row items-center py-3 border-b border-border last:border-0">
      <Text className="text-xl mr-3">{icon}</Text>
      <View className="flex-1">
        <Text className="text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>{label}</Text>
        <Text className="text-text-primary text-sm" style={{ fontFamily: 'Inter_500Medium' }}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Edit form ────────────────────────────────────────────────────────────────

function TruckEditForm({
  truck,
  onSave,
  onCancel,
  isSaving,
  saveLabel = 'Guardar',
}: {
  truck?: Truck;
  onSave: (values: TruckForm) => void;
  onCancel: () => void;
  isSaving: boolean;
  saveLabel?: string;
}) {
  const { control, handleSubmit, watch, formState: { errors } } = useForm<TruckForm>({
    resolver: zodResolver(truckSchema),
    defaultValues: {
      plate:       truck?.plate ?? '',
      make:        truck?.make ?? '',
      model:       truck?.model ?? '',
      year:        truck?.year ? String(truck.year) : '',
      type:        truck?.type ?? undefined,
      capacityKg:  truck?.capacityKg ?? '',
      odometerKm:  truck?.odometerKm != null ? String(truck.odometerKm) : '',
      notes:       truck?.notes ?? '',
    },
  });

  return (
    <View className="gap-y-4">
      <Controller
        control={control}
        name="plate"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Placa"
            placeholder="ABC-1234"
            autoCapitalize="characters"
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
            error={errors.plate?.message}
          />
        )}
      />

      <View className="flex-row gap-x-3">
        <View className="flex-1">
          <Controller
            control={control}
            name="make"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Marca"
                placeholder="Volvo"
                autoCapitalize="words"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.make?.message}
              />
            )}
          />
        </View>
        <View className="flex-1">
          <Controller
            control={control}
            name="model"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Modelo"
                placeholder="VNL 760"
                autoCapitalize="words"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.model?.message}
              />
            )}
          />
        </View>
      </View>

      <View className="flex-row gap-x-3">
        <View className="flex-1">
          <Controller
            control={control}
            name="year"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Año"
                placeholder="2022"
                keyboardType="number-pad"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value ?? ''}
                error={errors.year?.message}
              />
            )}
          />
        </View>
        <View className="flex-1">
          <Controller
            control={control}
            name="capacityKg"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Capacidad (kg)"
                placeholder="20000"
                keyboardType="number-pad"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value ?? ''}
                error={errors.capacityKg?.message}
              />
            )}
          />
        </View>
      </View>

      <View className="flex-row gap-x-3">
        <View className="flex-1">
          <Controller
            control={control}
            name="odometerKm"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Odómetro (km)"
                placeholder="150000"
                keyboardType="number-pad"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value ?? ''}
                error={errors.odometerKm?.message}
              />
            )}
          />
        </View>
        <View className="flex-1" />
      </View>

      {/* Type selector */}
      <View>
        <Text className="text-sm text-text-secondary mb-2" style={{ fontFamily: 'Inter_500Medium' }}>
          Tipo de vehículo
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {TRUCK_TYPES.map((t) => {
            const active = watch('type') === t.value;
            return (
              <Controller
                key={t.value}
                control={control}
                name="type"
                render={({ field: { onChange, value } }) => (
                  <TouchableOpacity
                    onPress={() => onChange(value === t.value ? undefined : t.value)}
                    activeOpacity={0.75}
                    className={`flex-row items-center px-3 py-2 rounded-xl border ${
                      active ? 'bg-primary-50 border-primary-400' : 'bg-white border-border'
                    }`}
                  >
                    <Text className="text-base mr-1.5">{t.icon}</Text>
                    <Text
                      className={`text-xs font-medium ${active ? 'text-primary-700' : 'text-text-secondary'}`}
                      style={{ fontFamily: 'Inter_500Medium' }}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            );
          })}
        </View>
      </View>

      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Notas (opcional)"
            placeholder="Ej. Revisión pendiente frenos"
            multiline
            numberOfLines={3}
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
            error={errors.notes?.message}
          />
        )}
      />

      <View className="flex-row gap-x-3 mt-2">
        <View className="flex-1">
          <Button variant="outline" fullWidth onPress={onCancel}>
            Cancelar
          </Button>
        </View>
        <View className="flex-1">
          <Button fullWidth loading={isSaving} onPress={handleSubmit(onSave)}>
            {saveLabel}
          </Button>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

function buildPayload(values: TruckForm) {
  return {
    plate:      values.plate,
    make:       values.make || undefined,
    model:      values.model || undefined,
    year:       values.year ? parseInt(values.year, 10) : undefined,
    type:       values.type,
    capacityKg: values.capacityKg || undefined,
    odometerKm: values.odometerKm ? parseInt(values.odometerKm, 10) : undefined,
    notes:      values.notes || undefined,
  };
}

export default function MyTruckScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId   = useAuthStore((s) => s.user?.id);
  const driverId = useAuthStore((s) => s.driverId);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Stable cache key: use driverId when available, fall back to userId
  const truckQueryKey = ['my-truck', driverId ?? userId];

  const { data, isLoading } = useQuery({
    queryKey: truckQueryKey,
    // Drivers: filter by their assigned driverId. Others: list company trucks (API scopes by companyId).
    queryFn: () => TrucksService.getAll({ ...(driverId ? { driverId } : {}), limit: 1 }),
    enabled: !!userId,
    staleTime: 2 * 60_000,
    select: (res) => res.data[0] ?? null,
  });

  const truck = data ?? null;
  const showNoTruck = !isLoading && !truck;

  const createMutation = useMutation({
    mutationFn: (values: TruckForm) =>
      TrucksService.create({
        ...buildPayload(values),
        currentDriverId: driverId ?? undefined,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData(truckQueryKey, { data: [created], total: 1, page: 1, limit: 10 });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      setIsCreating(false);
      Alert.alert('¡Vehículo registrado!', `Placa ${created.plate} guardada correctamente.`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo registrar el vehículo.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: TruckStatus }) =>
      TrucksService.updateStatus(truck!.id, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(truckQueryKey, { data: [updated], total: 1, page: 1, limit: 10 });
    },
    onError: () => Alert.alert('Error', 'No se pudo actualizar el estado.'),
  });

  const editMutation = useMutation({
    mutationFn: (values: TruckForm) =>
      TrucksService.update(truck!.id, buildPayload(values)),
    onSuccess: (updated) => {
      queryClient.setQueryData(truckQueryKey, { data: [updated], total: 1, page: 1, limit: 10 });
      setIsEditing(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo actualizar el vehículo.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const handleStatusChange = (status: TruckStatus) => {
    if (!truck || truck.status === status) return;
    const cfg = STATUS_CONFIG[status];
    Alert.alert(
      'Cambiar estado',
      `¿Marcar vehículo como "${cfg.label}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => statusMutation.mutate({ status }) },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-12"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center px-4 pt-5 pb-4 bg-white border-b border-border">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-9 h-9 bg-surface-secondary rounded-full items-center justify-center border border-border mr-3"
            >
              <Text className="text-text-primary">←</Text>
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-lg text-text-primary" style={{ fontFamily: 'Inter_700Bold' }}>
                Mi vehículo
              </Text>
            </View>
            {truck && !isEditing && !isCreating && (
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                className="flex-row items-center bg-primary-50 border border-primary-200 rounded-xl px-3 py-1.5"
              >
                <Text className="text-primary-700 text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                  ✏️ Editar
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Loading */}
          {isLoading && (
            <View className="flex-1 items-center justify-center pt-20">
              <Text className="text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>Cargando...</Text>
            </View>
          )}

          {/* No truck */}
          {showNoTruck && !isCreating && (
            <View className="items-center px-8 pt-20">
              <Text className="text-5xl mb-4">🚛</Text>
              <Text className="text-text-primary text-lg font-bold text-center mb-2" style={{ fontFamily: 'Inter_700Bold' }}>
                Sin vehículo registrado
              </Text>
              <Text className="text-text-muted text-sm text-center mb-6" style={{ fontFamily: 'Inter_400Regular' }}>
                Registra tu camión para empezar a gestionar tus runs.
              </Text>
              <Button fullWidth onPress={() => setIsCreating(true)}>
                + Registrar mi vehículo
              </Button>
            </View>
          )}

          {/* Create form */}
          {showNoTruck && isCreating && (
            <View className="px-4 pt-5">
              <Card>
                <Text className="text-text-primary font-semibold mb-4" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Registrar nuevo vehículo
                </Text>
                <TruckEditForm
                  onSave={(values) => createMutation.mutate(values)}
                  onCancel={() => setIsCreating(false)}
                  isSaving={createMutation.isPending}
                  saveLabel="Registrar vehículo"
                />
              </Card>
            </View>
          )}

          {/* Truck found */}
          {!isLoading && truck && (
            <View className="px-4 pt-5 gap-y-4">

              {/* Plate hero */}
              {!isEditing && (
                <View className="bg-white rounded-2xl border border-border p-5 items-center">
                  <View className="bg-surface-secondary border-2 border-border rounded-xl px-8 py-3 mb-3">
                    <Text className="text-3xl font-bold text-text-primary tracking-widest" style={{ fontFamily: 'Inter_700Bold' }}>
                      {truck.plate}
                    </Text>
                  </View>
                  {(truck.make || truck.model || truck.year) && (
                    <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                      {[truck.make, truck.model, truck.year].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {truck.type && (
                    <View className="mt-2 flex-row items-center bg-primary-50 rounded-full px-3 py-1">
                      <Text className="text-xs mr-1">
                        {TRUCK_TYPES.find((t) => t.value === truck.type)?.icon ?? '🚛'}
                      </Text>
                      <Text className="text-primary-700 text-xs font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                        {TRUCK_TYPES.find((t) => t.value === truck.type)?.label ?? truck.type}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Status section */}
              {!isEditing && (
                <Card>
                  <Text className="text-text-secondary text-xs font-medium mb-3" style={{ fontFamily: 'Inter_500Medium' }}>
                    ESTADO DEL VEHÍCULO
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {EDITABLE_STATUSES.map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      const isActive = truck.status === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          onPress={() => handleStatusChange(s)}
                          disabled={statusMutation.isPending}
                          activeOpacity={0.75}
                          className={`flex-row items-center px-3 py-2 rounded-xl border ${
                            isActive ? cfg.color : 'bg-white border-border'
                          }`}
                        >
                          <View className={`w-2 h-2 rounded-full mr-2 ${isActive ? cfg.dot : 'bg-slate-300'}`} />
                          <Text
                            className={`text-xs font-medium ${isActive ? 'text-text-primary' : 'text-text-muted'}`}
                            style={{ fontFamily: 'Inter_500Medium' }}
                          >
                            {cfg.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {truck.status === 'in_transit' && (
                    <View className="mt-3 flex-row items-center bg-blue-50 rounded-xl px-3 py-2.5">
                      <Text className="text-sm mr-2">🚛</Text>
                      <Text className="text-blue-700 text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                        En tránsito activo — el estado se actualiza automáticamente.
                      </Text>
                    </View>
                  )}
                </Card>
              )}

              {/* Details card */}
              {!isEditing && (
                <Card>
                  <Text className="text-text-secondary text-xs font-medium mb-1" style={{ fontFamily: 'Inter_500Medium' }}>
                    DETALLES
                  </Text>
                  <InfoRow icon="🔢" label="Odómetro" value={truck.odometerKm != null ? `${truck.odometerKm.toLocaleString()} km` : '—'} />
                  {truck.insuranceExpiresAt && (
                    <InfoRow icon="🛡" label="Vencimiento seguro" value={new Date(truck.insuranceExpiresAt).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' })} />
                  )}
                  {truck.registrationExpiresAt && (
                    <InfoRow icon="📋" label="Vencimiento registro" value={new Date(truck.registrationExpiresAt).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' })} />
                  )}
                  {truck.notes && (
                    <InfoRow icon="📝" label="Notas" value={truck.notes} />
                  )}
                </Card>
              )}

              {/* Edit form */}
              {isEditing && (
                <Card>
                  <Text className="text-text-primary font-semibold mb-4" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    Editar vehículo
                  </Text>
                  <TruckEditForm
                    truck={truck}
                    onSave={(v) => editMutation.mutate(v)}
                    onCancel={() => setIsEditing(false)}
                    isSaving={editMutation.isPending}
                    saveLabel="Guardar cambios"
                  />
                </Card>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
