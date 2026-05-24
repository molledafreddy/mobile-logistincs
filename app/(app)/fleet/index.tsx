import { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { DriversService } from '../../../src/services/api/drivers.service';
import { TrucksService } from '../../../src/services/api/trucks.service';
import { CompaniesService } from '../../../src/services/api/companies.service';
import { useAuthStore } from '../../../src/stores/auth.store';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import type { Driver, Truck, DriverStatus, TruckStatus } from '../../../src/types';

// ─── Create driver schema ─────────────────────────────────────────────────────

const driverSchema = z.object({
  firstName:     z.string().min(1, 'Requerido'),
  lastName:      z.string().min(1, 'Requerido'),
  licenseNumber: z.string().min(1, 'Requerido'),
  phone:         z.string().optional(),
  email:         z.string().optional().refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'Email inválido',
  ),
});

type DriverForm = z.infer<typeof driverSchema>;

// ─── Create driver sheet ──────────────────────────────────────────────────────

function CreateDriverSheet({
  sheetRef,
  isSaving,
  onSave,
}: {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  isSaving: boolean;
  onSave: (values: DriverForm) => void;
}) {
  const { control, handleSubmit, reset, formState: { errors } } = useForm<DriverForm>({
    resolver: zodResolver(driverSchema),
    defaultValues: { firstName: '', lastName: '', licenseNumber: '', phone: '', email: '' },
  });

  const handleSave = (values: DriverForm) => {
    onSave(values);
    reset();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['70%', '92%']}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
      backgroundStyle={{ backgroundColor: '#fff' }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-text-primary text-base font-bold mb-1" style={{ fontFamily: 'Inter_700Bold' }}>
          Nuevo conductor
        </Text>
        <Text className="text-text-muted text-xs mb-5" style={{ fontFamily: 'Inter_400Regular' }}>
          Completa los datos del conductor para registrarlo en tu flota.
        </Text>

        <View className="flex-row gap-x-3 mb-4">
          <View className="flex-1">
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nombre"
                  placeholder="Juan"
                  autoCapitalize="words"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.firstName?.message}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Apellido"
                  placeholder="Pérez"
                  autoCapitalize="words"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.lastName?.message}
                />
              )}
            />
          </View>
        </View>

        <View className="mb-4">
          <Controller
            control={control}
            name="licenseNumber"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nº de licencia"
                placeholder="LIC-123456"
                autoCapitalize="characters"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.licenseNumber?.message}
              />
            )}
          />
        </View>

        <View className="flex-row gap-x-3 mb-6">
          <View className="flex-1">
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Teléfono (opcional)"
                  placeholder="+1 555 0000"
                  keyboardType="phone-pad"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.phone?.message}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email (opcional)"
                  placeholder="j@empresa.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.email?.message}
                />
              )}
            />
          </View>
        </View>

        <Button fullWidth loading={isSaving} onPress={handleSubmit(handleSave)}>
          Registrar conductor
        </Button>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Status configs ───────────────────────────────────────────────────────────

const DRIVER_STATUS: Record<DriverStatus, { label: string; bg: string; text: string }> = {
  available:  { label: 'Disponible',  bg: 'bg-primary-50',  text: 'text-primary-700' },
  on_trip:    { label: 'En viaje',    bg: 'bg-blue-50',     text: 'text-blue-700' },
  off_duty:   { label: 'Fuera',       bg: 'bg-gray-100',    text: 'text-gray-600' },
  suspended:  { label: 'Suspendido',  bg: 'bg-red-50',      text: 'text-red-600' },
};

const TRUCK_STATUS: Record<TruckStatus, { label: string; bg: string; text: string }> = {
  available:      { label: 'Disponible',  bg: 'bg-primary-50',  text: 'text-primary-700' },
  in_transit:     { label: 'En tránsito', bg: 'bg-blue-50',     text: 'text-blue-700' },
  maintenance:    { label: 'Mant.',       bg: 'bg-amber-50',    text: 'text-amber-700' },
  out_of_service: { label: 'Fuera',       bg: 'bg-red-50',      text: 'text-red-600' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View className="flex-row items-center justify-between mb-3 mt-1">
      <Text
        className="text-text-primary font-bold text-base"
        style={{ fontFamily: 'Inter_700Bold' }}
      >
        {title}
      </Text>
      <View className="bg-surface-secondary border border-border rounded-full px-2.5 py-0.5">
        <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_500Medium' }}>
          {count}
        </Text>
      </View>
    </View>
  );
}

function StatusBadge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-medium ${text}`} style={{ fontFamily: 'Inter_500Medium' }}>
        {label}
      </Text>
    </View>
  );
}

function DriverCard({
  driver,
  truck,
  onEditStatus,
}: {
  driver: Driver;
  truck?: Truck | null;
  onEditStatus?: () => void;
}) {
  const status = DRIVER_STATUS[driver.status] ?? DRIVER_STATUS.off_duty;
  return (
    <View className="bg-white rounded-2xl border border-border p-4 mb-3">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center flex-1 mr-2">
          <View className="w-9 h-9 bg-primary-100 rounded-full items-center justify-center mr-3">
            <Text className="text-primary-600 text-sm font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
              {driver.firstName[0]}{driver.lastName[0]}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-text-primary font-semibold"
              numberOfLines={1}
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              {driver.firstName} {driver.lastName}
            </Text>
            <Text
              className="text-text-muted text-xs"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Lic: {driver.licenseNumber}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onEditStatus} activeOpacity={0.7} disabled={!onEditStatus}>
          <StatusBadge {...status} />
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center mt-1">
        <Text className="text-sm mr-1.5">🚛</Text>
        <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
          {truck ? `${truck.plate}${truck.make ? ` · ${truck.make}` : ''}` : 'Sin vehículo asignado'}
        </Text>
      </View>

      {driver.phone && (
        <View className="flex-row items-center mt-1">
          <Text className="text-sm mr-1.5">📞</Text>
          <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
            {driver.phone}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Driver status sheet ──────────────────────────────────────────────────────

const DRIVER_STATUS_OPTIONS: DriverStatus[] = ['available', 'off_duty', 'suspended'];

function DriverStatusSheet({
  sheetRef,
  driver,
  isLoading,
  onSelect,
}: {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  driver: Driver | null;
  isLoading: boolean;
  onSelect: (status: DriverStatus) => void;
}) {
  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['38%']}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
      backgroundStyle={{ backgroundColor: '#fff' }}
    >
      <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 }}>
        <Text className="text-text-primary text-base font-bold mb-0.5" style={{ fontFamily: 'Inter_700Bold' }}>
          Cambiar estado
        </Text>
        <Text className="text-text-muted text-xs mb-4" style={{ fontFamily: 'Inter_400Regular' }}>
          {driver?.firstName} {driver?.lastName}
        </Text>
        {DRIVER_STATUS_OPTIONS.map((s) => {
          const cfg = DRIVER_STATUS[s];
          const isCurrent = driver?.status === s;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => !isCurrent && onSelect(s)}
              disabled={isLoading || isCurrent}
              activeOpacity={0.75}
              className={`flex-row items-center rounded-xl border px-4 py-3 mb-2 ${
                isCurrent ? 'bg-primary-50 border-primary-200' : 'bg-white border-border'
              }`}
            >
              <View className={`flex-1`}>
                <Text
                  className={`font-medium text-sm ${isCurrent ? 'text-primary-700' : 'text-text-primary'}`}
                  style={{ fontFamily: 'Inter_500Medium' }}
                >
                  {cfg.label}
                </Text>
              </View>
              {isCurrent && (
                <View className="bg-primary-100 rounded-full px-2 py-0.5">
                  <Text className="text-primary-700 text-xs" style={{ fontFamily: 'Inter_500Medium' }}>
                    Actual
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function TruckCard({
  truck,
  driver,
  onManage,
}: {
  truck: Truck;
  driver?: Driver | null;
  onManage: () => void;
}) {
  const status = TRUCK_STATUS[truck.status] ?? TRUCK_STATUS.out_of_service;
  return (
    <TouchableOpacity
      onPress={onManage}
      activeOpacity={0.75}
      className="bg-white rounded-2xl border border-border p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-2">
          <Text
            className="text-text-primary font-semibold text-base"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            {truck.plate}
          </Text>
          <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            {[truck.make, truck.model, truck.year].filter(Boolean).join(' · ') || truck.type || 'Vehículo'}
          </Text>
        </View>
        <View className="flex-row items-center gap-x-1.5">
          <StatusBadge {...status} />
          <Text className="text-text-muted text-xs">›</Text>
        </View>
      </View>

      <View className="flex-row items-center">
        <Text className="text-sm mr-1.5">👤</Text>
        <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
          {driver
            ? `${driver.firstName} ${driver.lastName}`
            : 'Sin conductor asignado'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Assign driver sheet ──────────────────────────────────────────────────────

interface AssignSheetProps {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  truck: Truck | null;
  drivers: Driver[];
  isLoading: boolean;
  onAssign: (driverId: string) => void;
  onUnassign: () => void;
}

function AssignDriverSheet({
  sheetRef,
  truck,
  drivers,
  isLoading,
  onAssign,
  onUnassign,
}: AssignSheetProps) {
  const available = drivers.filter(
    (d) => d.status === 'available' || d.currentTruckId === truck?.id,
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['55%', '85%']}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
      backgroundStyle={{ backgroundColor: '#fff' }}
    >
      <View className="px-5 pb-2 pt-1">
        <Text
          className="text-text-primary text-base font-bold mb-0.5"
          style={{ fontFamily: 'Inter_700Bold' }}
        >
          Asignar conductor
        </Text>
        <Text className="text-text-muted text-xs mb-3" style={{ fontFamily: 'Inter_400Regular' }}>
          Camión {truck?.plate} · {truck?.make ?? truck?.type ?? 'Vehículo'}
        </Text>

        {truck?.currentDriverId && (
          <TouchableOpacity
            onPress={onUnassign}
            disabled={isLoading}
            className="flex-row items-center bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-3"
            activeOpacity={0.75}
          >
            <Text className="text-lg mr-3">🚫</Text>
            <Text
              className="text-red-600 font-medium"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              Desasignar conductor actual
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <BottomSheetFlatList
        data={available}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
              No hay conductores disponibles
            </Text>
          </View>
        }
        renderItem={({ item: driver }) => {
          const isCurrent = driver.currentTruckId === truck?.id;
          return (
            <TouchableOpacity
              onPress={() => !isCurrent && onAssign(driver.id)}
              disabled={isLoading || isCurrent}
              activeOpacity={0.75}
              className={`flex-row items-center rounded-xl border px-4 py-3 mb-2 ${
                isCurrent
                  ? 'bg-primary-50 border-primary-200'
                  : 'bg-white border-border'
              }`}
            >
              <View className="w-8 h-8 bg-primary-100 rounded-full items-center justify-center mr-3">
                <Text className="text-primary-600 text-xs font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
                  {driver.firstName[0]}{driver.lastName[0]}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  className={`font-medium text-sm ${isCurrent ? 'text-primary-700' : 'text-text-primary'}`}
                  style={{ fontFamily: 'Inter_500Medium' }}
                >
                  {driver.firstName} {driver.lastName}
                </Text>
                <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                  Lic: {driver.licenseNumber}
                </Text>
              </View>
              {isCurrent && (
                <View className="bg-primary-100 rounded-full px-2 py-0.5">
                  <Text className="text-primary-700 text-xs" style={{ fontFamily: 'Inter_500Medium' }}>
                    Actual
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </BottomSheetModal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FleetScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const assignSheetRef       = useRef<BottomSheetModalMethods>(null);
  const statusSheetRef       = useRef<BottomSheetModalMethods>(null);
  const createDriverSheetRef = useRef<BottomSheetModalMethods>(null);
  const [selectedTruck, setSelectedTruck]   = useState<Truck | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const { data: company } = useQuery({
    queryKey: ['company', user?.companyId],
    queryFn: () => CompaniesService.getById(user!.companyId!),
    enabled: !!user?.companyId,
    staleTime: 5 * 60_000,
  });

  const {
    data: driversData,
    isLoading: driversLoading,
    refetch: refetchDrivers,
    isRefetching: driversRefetching,
  } = useQuery({
    queryKey: ['fleet', 'drivers'],
    queryFn: () => DriversService.getAll({ limit: 100 }),
  });

  const {
    data: trucksData,
    isLoading: trucksLoading,
    refetch: refetchTrucks,
    isRefetching: trucksRefetching,
  } = useQuery({
    queryKey: ['fleet', 'trucks'],
    queryFn: () => TrucksService.getAll({ limit: 100 }),
  });

  const drivers = driversData?.data ?? [];
  const trucks = trucksData?.data ?? [];

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const truckById = new Map(trucks.map((t) => [t.id, t]));

  const invalidateFleet = () => {
    queryClient.invalidateQueries({ queryKey: ['fleet'] });
  };

  const createDriverMutation = useMutation({
    mutationFn: (values: DriverForm) =>
      DriversService.create({
        firstName:     values.firstName,
        lastName:      values.lastName,
        licenseNumber: values.licenseNumber,
        phone:         values.phone || undefined,
        email:         values.email || undefined,
      }),
    onSuccess: (created) => {
      createDriverSheetRef.current?.dismiss();
      invalidateFleet();
      Alert.alert('¡Conductor registrado!', `${created.firstName} ${created.lastName} fue agregado a tu flota.`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo registrar el conductor.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ truckId, driverId }: { truckId: string; driverId: string }) =>
      TrucksService.assignDriver(truckId, driverId),
    onSuccess: () => {
      assignSheetRef.current?.dismiss();
      invalidateFleet();
    },
    onError: () => Alert.alert('Error', 'No se pudo asignar el conductor.'),
  });

  const unassignMutation = useMutation({
    mutationFn: (truckId: string) => TrucksService.unassignDriver(truckId),
    onSuccess: () => {
      assignSheetRef.current?.dismiss();
      invalidateFleet();
    },
    onError: () => Alert.alert('Error', 'No se pudo desasignar el conductor.'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ driverId, status }: { driverId: string; status: DriverStatus }) =>
      DriversService.updateStatus(driverId, status),
    onSuccess: () => {
      statusSheetRef.current?.dismiss();
      invalidateFleet();
    },
    onError: () => Alert.alert('Error', 'No se pudo cambiar el estado del conductor.'),
  });

  const handleEditStatus = (driver: Driver) => {
    setSelectedDriver(driver);
    statusSheetRef.current?.present();
  };

  const handleStatusSelect = (status: DriverStatus) => {
    if (!selectedDriver) return;
    updateStatusMutation.mutate({ driverId: selectedDriver.id, status });
  };

  const handleManageTruck = (truck: Truck) => {
    setSelectedTruck(truck);
    assignSheetRef.current?.present();
  };

  const handleAssign = (driverId: string) => {
    if (!selectedTruck) return;
    Alert.alert(
      'Asignar conductor',
      `¿Asignar este conductor al camión ${selectedTruck.plate}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Asignar',
          onPress: () =>
            assignMutation.mutate({ truckId: selectedTruck.id, driverId }),
        },
      ],
    );
  };

  const handleUnassign = () => {
    if (!selectedTruck) return;
    Alert.alert(
      'Desasignar conductor',
      `¿Quitar el conductor del camión ${selectedTruck.plate}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desasignar',
          style: 'destructive',
          onPress: () => unassignMutation.mutate(selectedTruck.id),
        },
      ],
    );
  };

  const isRefreshing = driversRefetching || trucksRefetching;
  const isLoading = driversLoading || trucksLoading;
  const mutationPending = assignMutation.isPending || unassignMutation.isPending;

  const isBasicPlan = company?.businessModel === 'independent';
  const driverLimitReached = isBasicPlan && drivers.length >= 1;

  const handleAddDriver = () => {
    if (driverLimitReached) {
      Alert.alert(
        'Límite de conductores alcanzado',
        'Tu plan básico permite registrar solo 1 conductor. Actualiza tu plan para agregar más conductores a tu flota.',
        [{ text: 'Entendido', style: 'cancel' }],
      );
      return;
    }
    createDriverSheetRef.current?.present();
  };

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
            Gestión de flota
          </Text>
          <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            {drivers.length} conductores · {trucks.length} vehículos
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleAddDriver}
          className="flex-row items-center rounded-xl px-3 py-2 gap-x-1.5"
          style={{ backgroundColor: driverLimitReached ? '#94a3b8' : '#22c55e' }}
          activeOpacity={0.8}
        >
          <Text className="text-white text-base leading-none">
            {driverLimitReached ? '🔒' : '+'}
          </Text>
          <Text className="text-white text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
            Conductor
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
            Cargando flota…
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-10"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                refetchDrivers();
                refetchTrucks();
              }}
              tintColor="#22c55e"
            />
          }
        >
          {/* ── Conductores ── */}
          <View className="mt-2">
            <SectionHeader title="Conductores" count={drivers.length} />

            {drivers.length === 0 ? (
              <View className="bg-white rounded-2xl border border-border p-6 items-center mb-4">
                <Text className="text-3xl mb-2">👤</Text>
                <Text
                  className="text-text-muted text-sm text-center"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  No hay conductores registrados en tu empresa
                </Text>
              </View>
            ) : (
              drivers.map((driver) => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  truck={
                    driver.currentTruckId
                      ? (truckById.get(driver.currentTruckId) ?? null)
                      : null
                  }
                  onEditStatus={() => handleEditStatus(driver)}
                />
              ))
            )}
          </View>

          {/* ── Vehículos ── */}
          <View className="mt-2">
            <SectionHeader title="Vehículos" count={trucks.length} />

            {trucks.length === 0 ? (
              <View className="bg-white rounded-2xl border border-border p-6 items-center">
                <Text className="text-3xl mb-2">🚛</Text>
                <Text
                  className="text-text-muted text-sm text-center"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  No hay vehículos registrados en tu empresa
                </Text>
              </View>
            ) : (
              trucks.map((truck) => (
                <TruckCard
                  key={truck.id}
                  truck={truck}
                  driver={
                    truck.currentDriverId
                      ? (driverById.get(truck.currentDriverId) ?? null)
                      : null
                  }
                  onManage={() => handleManageTruck(truck)}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}

      <AssignDriverSheet
        sheetRef={assignSheetRef}
        truck={selectedTruck}
        drivers={drivers}
        isLoading={mutationPending}
        onAssign={handleAssign}
        onUnassign={handleUnassign}
      />

      <DriverStatusSheet
        sheetRef={statusSheetRef}
        driver={selectedDriver}
        isLoading={updateStatusMutation.isPending}
        onSelect={handleStatusSelect}
      />

      <CreateDriverSheet
        sheetRef={createDriverSheetRef}
        isSaving={createDriverMutation.isPending}
        onSave={(values) => createDriverMutation.mutate(values)}
      />
    </SafeAreaView>
  );
}
