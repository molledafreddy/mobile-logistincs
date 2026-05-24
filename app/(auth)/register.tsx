import { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { AuthService } from '../../src/services/api/auth.service';
import { useAuthStore } from '../../src/stores/auth.store';

// ─── Validation ───────────────────────────────────────────────────────────────

const registerSchema = z.object({
  firstName:       z.string().min(2, 'Mínimo 2 caracteres').max(50),
  lastName:        z.string().min(2, 'Mínimo 2 caracteres').max(50),
  email:           z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir una mayúscula')
    .regex(/[a-z]/, 'Debe incluir una minúscula')
    .regex(/\d/,    'Debe incluir un número')
    .regex(/[@$!%*?&]/, 'Debe incluir un carácter especial (@$!%*?&)'),
  confirmPassword: z.string(),
  companyName:     z.string().min(2, 'Mínimo 2 caracteres').max(100),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

// ─── Password strength chips ──────────────────────────────────────────────────

const REQUIREMENTS = [
  { label: '8+ caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Mayúscula',     test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Minúscula',     test: (p: string) => /[a-z]/.test(p) },
  { label: 'Número',        test: (p: string) => /\d/.test(p) },
  { label: 'Especial',      test: (p: string) => /[@$!%*?&]/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5 mt-2">
      {REQUIREMENTS.map(({ label, test }) => {
        const ok = test(password);
        return (
          <View
            key={label}
            className={`px-2.5 py-1 rounded-full border ${
              ok ? 'bg-primary-50 border-primary-300' : 'bg-surface-secondary border-border'
            }`}
          >
            <Text
              className={`text-xs ${ok ? 'text-primary-700' : 'text-text-muted'}`}
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {ok ? '✓ ' : '○ '}{label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router = useRouter();
  const loginWithSession = useAuthStore((s) => s.loginWithSession);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName:       '',
      lastName:        '',
      email:           '',
      password:        '',
      confirmPassword: '',
      companyName:     '',
    },
  });

  const passwordValue = watch('password');

  const onSubmit = async (values: RegisterForm) => {
    setIsLoading(true);
    try {
      const result = await AuthService.register({
        firstName:   values.firstName,
        lastName:    values.lastName,
        email:       values.email,
        password:    values.password,
        companyName: values.companyName,
        companyType: 'carrier',
      });

      if (!result.session) {
        Alert.alert(
          'Cuenta creada',
          'Tu cuenta fue creada. Inicia sesión para continuar.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
        );
        return;
      }

      await loginWithSession(
        result.user,
        result.session.accessToken,
        result.session.refreshToken,
      );
      router.replace('/(auth)/setup');
    } catch (err: unknown) {
      const status  = (err as any)?.response?.status;
      const message = (err as any)?.response?.data?.message ?? 'No se pudo crear la cuenta. Intenta de nuevo.';

      if (status === 409) {
        Alert.alert('Email en uso', 'Ya existe una cuenta con ese email. ¿Quieres iniciar sesión?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Iniciar sesión', onPress: () => router.replace('/(auth)/login') },
        ]);
      } else if (status === 429) {
        Alert.alert('Demasiados intentos', 'Espera un momento antes de intentarlo de nuevo.');
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
          <View className="items-center pt-12 pb-8">
            <View className="w-16 h-16 bg-primary-500 rounded-2xl items-center justify-center mb-4">
              <Text className="text-3xl">🚛</Text>
            </View>
            <Text className="text-2xl text-text-primary mb-1" style={{ fontFamily: 'Inter_700Bold' }}>
              Crea tu cuenta
            </Text>
            <Text className="text-text-secondary text-sm text-center" style={{ fontFamily: 'Inter_400Regular' }}>
              Empieza a gestionar tus envíos hoy
            </Text>
          </View>

          {/* ── Datos personales ── */}
          <Text className="text-xs text-text-muted uppercase tracking-widest mb-3" style={{ fontFamily: 'Inter_600SemiBold' }}>
            Tus datos
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
                    returnKeyType="next"
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
                    returnKeyType="next"
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
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Correo electrónico"
                  placeholder="juan@ejemplo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.email?.message}
                />
              )}
            />
          </View>

          <View className="mb-1">
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Contraseña"
                  placeholder="••••••••"
                  secureTextEntry
                  returnKeyType="next"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.password?.message}
                />
              )}
            />
            <PasswordStrength password={passwordValue} />
          </View>

          <View className="mt-4 mb-6">
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirmar contraseña"
                  placeholder="••••••••"
                  secureTextEntry
                  returnKeyType="next"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.confirmPassword?.message}
                />
              )}
            />
          </View>

          {/* ── Negocio ── */}
          <Text className="text-xs text-text-muted uppercase tracking-widest mb-3" style={{ fontFamily: 'Inter_600SemiBold' }}>
            Tu negocio
          </Text>

          <View className="mb-8">
            <Controller
              control={control}
              name="companyName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nombre de empresa / negocio"
                  placeholder="Transportes Pérez"
                  autoCapitalize="words"
                  returnKeyType="done"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.companyName?.message}
                />
              )}
            />
          </View>

          {/* Submit */}
          <Button fullWidth loading={isLoading} onPress={handleSubmit(onSubmit)} size="lg">
            Crear cuenta
          </Button>

          {/* Login link */}
          <View className="items-center mt-6">
            <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
              ¿Ya tienes cuenta?{' '}
              <Text
                className="text-primary-600 font-medium"
                style={{ fontFamily: 'Inter_500Medium' }}
                onPress={() => router.replace('/(auth)/login')}
              >
                Inicia sesión
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
