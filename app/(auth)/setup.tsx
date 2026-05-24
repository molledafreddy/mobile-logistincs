import { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/stores/auth.store';
import { DriversService } from '../../src/services/api/drivers.service';
import { TrucksService } from '../../src/services/api/trucks.service';
import { StorageService } from '../../src/services/storage/storage.service';
import type { TruckType } from '../../src/types';

// ─── Step 1: Driver profile ───────────────────────────────────────────────────

const driverSchema = z.object({
  licenseNumber: z.string().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres'),
  phone: z.string().max(30).optional().or(z.literal('')),
});

type DriverForm = z.infer<typeof driverSchema>;

// ─── Step 2: Truck ────────────────────────────────────────────────────────────

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
  type:  z.enum(['flatbed', 'reefer', 'dry-van', 'tanker', 'box', 'other']).optional(),
});

type TruckForm = z.infer<typeof truckSchema>;

// ─── Truck type selector ──────────────────────────────────────────────────────

const TRUCK_TYPES: { value: TruckType; label: string; icon: string }[] = [
  { value: 'box',      label: 'Caja',      icon: '📦' },
  { value: 'flatbed',  label: 'Plataforma', icon: '🚛' },
  { value: 'dry-van',  label: 'Dry Van',   icon: '🚚' },
  { value: 'reefer',   label: 'Refrigerado', icon: '❄️' },
  { value: 'tanker',   label: 'Tanque',    icon: '🛢' },
  { value: 'other',    label: 'Otro',      icon: '🚐' },
];

function TruckTypeSelector({
  value,
  onChange,
}: {
  value?: TruckType;
  onChange: (v: TruckType) => void;
}) {
  return (
    <View>
      <Text className="text-sm text-text-secondary mb-2" style={{ fontFamily: 'Inter_500Medium' }}>
        Tipo de vehículo (opcional)
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {TRUCK_TYPES.map((t) => {
          const active = value === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => onChange(t.value)}
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
          );
        })}
      </View>
    </View>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <View className="flex-row items-center justify-center mb-8 gap-x-2">
      {[1, 2].map((n) => (
        <View key={n} className="flex-row items-center">
          <View
            className={`w-8 h-8 rounded-full items-center justify-center ${
              step >= n ? 'bg-primary-500' : 'bg-surface-secondary border border-border'
            }`}
          >
            <Text
              className={`text-xs font-bold ${step >= n ? 'text-white' : 'text-text-muted'}`}
              style={{ fontFamily: 'Inter_700Bold' }}
            >
              {n}
            </Text>
          </View>
          {n < 2 && (
            <View className={`w-12 h-0.5 mx-1 ${step > 1 ? 'bg-primary-500' : 'bg-border'}`} />
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setDriverId = useAuthStore((s) => s.setDriverId);
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [driverData, setDriverData] = useState<DriverForm | null>(null);

  const driverForm = useForm<DriverForm>({
    resolver: zodResolver(driverSchema),
    defaultValues: { licenseNumber: '', phone: '' },
  });

  const truckForm = useForm<TruckForm>({
    resolver: zodResolver(truckSchema),
    defaultValues: { plate: '', make: '', model: '', year: undefined, type: undefined },
  });

  useEffect(() => {
    if (StorageService.isSetupCompleted()) {
      router.replace('/(app)/(tabs)/home');
    }
  }, []);

  const handleSkip = () => {
    router.replace('/onboarding');
  };

  const handleDriverNext = (values: DriverForm) => {
    setDriverData(values);
    setStep(2);
  };

  const handleTruckSubmit = async (values: TruckForm) => {
    if (!user || !driverData) return;
    setIsLoading(true);

    try {
      // 1. Create driver profile linked to this user
      const driver = await DriversService.create({
        userId:        user.id,
        firstName:     user.firstName,
        lastName:      user.lastName,
        licenseNumber: driverData.licenseNumber,
        phone:         driverData.phone || undefined,
      });
      setDriverId(driver.id);

      // 2. Create truck
      const truck = await TrucksService.create({
        plate: values.plate,
        make:  values.make || undefined,
        model: values.model || undefined,
        year:  values.year ? parseInt(values.year, 10) : undefined,
        type:  values.type || undefined,
      });

      // 3. Assign driver to truck
      await TrucksService.assignDriver(truck.id, driver.id);

      StorageService.setSetupCompleted();
      router.replace('/onboarding');
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      const message =
        (err as any)?.response?.data?.message ?? 'No se pudo completar la configuración.';

      if (status === 409) {
        // Plate or license already registered — show field-specific feedback
        const msg = Array.isArray(message) ? message[0] : message;
        if (msg.toLowerCase().includes('plate') || msg.toLowerCase().includes('placa')) {
          truckForm.setError('plate', { message: 'Esta placa ya está registrada.' });
        } else if (msg.toLowerCase().includes('license') || msg.toLowerCase().includes('licencia')) {
          setStep(1);
          driverForm.setError('licenseNumber', { message: 'Esta licencia ya está registrada.' });
        } else {
          Alert.alert('Conflicto', msg);
        }
      } else {
        Alert.alert('Error', Array.isArray(message) ? message[0] : message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-12"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="pt-10 pb-6">
            <Text
              className="text-2xl text-text-primary mb-1"
              style={{ fontFamily: 'Inter_700Bold' }}
            >
              Configura tu cuenta
            </Text>
            <Text
              className="text-text-secondary text-sm"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {step === 1
                ? 'Añade tu perfil de conductor para empezar a operar.'
                : 'Ahora registra tu vehículo.'}
            </Text>
          </View>

          <StepIndicator step={step} />

          {/* ── Step 1: Driver profile ── */}
          {step === 1 && (
            <View>
              {/* Name display (read-only) */}
              <View className="bg-surface-secondary rounded-2xl px-4 py-3 mb-6 border border-border">
                <Text className="text-xs text-text-muted mb-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
                  Nombre del conductor
                </Text>
                <Text className="text-text-primary font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  {user?.firstName} {user?.lastName}
                </Text>
                <Text className="text-xs text-text-muted mt-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
                  {user?.email}
                </Text>
              </View>

              <View className="gap-y-4 mb-8">
                <Controller
                  control={driverForm.control}
                  name="licenseNumber"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Número de licencia de conducir"
                      placeholder="D1234567"
                      autoCapitalize="characters"
                      returnKeyType="next"
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                      error={driverForm.formState.errors.licenseNumber?.message}
                    />
                  )}
                />

                <Controller
                  control={driverForm.control}
                  name="phone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Teléfono (opcional)"
                      placeholder="+1 555 000 0000"
                      keyboardType="phone-pad"
                      returnKeyType="done"
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                      error={driverForm.formState.errors.phone?.message}
                    />
                  )}
                />
              </View>

              <Button
                fullWidth
                size="lg"
                onPress={driverForm.handleSubmit(handleDriverNext)}
              >
                Siguiente
              </Button>

              <TouchableOpacity onPress={handleSkip} className="items-center mt-4 py-2">
                <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                  Configurar después
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2: Truck ── */}
          {step === 2 && (
            <View>
              <View className="gap-y-4 mb-6">
                <Controller
                  control={truckForm.control}
                  name="plate"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Placa del vehículo"
                      placeholder="ABC-1234"
                      autoCapitalize="characters"
                      returnKeyType="next"
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                      error={truckForm.formState.errors.plate?.message}
                    />
                  )}
                />

                <View className="flex-row gap-x-3">
                  <View className="flex-1">
                    <Controller
                      control={truckForm.control}
                      name="make"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label="Marca (opcional)"
                          placeholder="Volvo"
                          autoCapitalize="words"
                          returnKeyType="next"
                          onChangeText={onChange}
                          onBlur={onBlur}
                          value={value}
                          error={truckForm.formState.errors.make?.message}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1">
                    <Controller
                      control={truckForm.control}
                      name="model"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label="Modelo (opcional)"
                          placeholder="VNL 760"
                          autoCapitalize="words"
                          returnKeyType="next"
                          onChangeText={onChange}
                          onBlur={onBlur}
                          value={value}
                          error={truckForm.formState.errors.model?.message}
                        />
                      )}
                    />
                  </View>
                </View>

                <Controller
                  control={truckForm.control}
                  name="year"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Año (opcional)"
                      placeholder="2022"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value ?? ''}
                      error={truckForm.formState.errors.year?.message}
                    />
                  )}
                />

                <Controller
                  control={truckForm.control}
                  name="type"
                  render={({ field: { onChange, value } }) => (
                    <TruckTypeSelector value={value} onChange={onChange} />
                  )}
                />
              </View>

              <View className="gap-y-3">
                <Button
                  fullWidth
                  size="lg"
                  loading={isLoading}
                  onPress={truckForm.handleSubmit(handleTruckSubmit)}
                >
                  Comenzar a operar
                </Button>

                <TouchableOpacity
                  onPress={() => setStep(1)}
                  className="items-center py-2"
                >
                  <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                    ← Volver
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
