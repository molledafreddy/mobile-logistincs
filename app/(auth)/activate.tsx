import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { AuthService } from '../../src/services/api/auth.service';
import { useAuthStore } from '../../src/stores/auth.store';

// Password rule mirrors backend AcceptInviteDto @Matches regex:
// uppercase + lowercase + digit + special char (@$!%*?&)
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;

const activateSchema = z
  .object({
    token: z.string().min(1, 'Token requerido'),
    firstName: z.string().min(2, 'Mínimo 2 caracteres').max(100),
    lastName: z.string().min(2, 'Mínimo 2 caracteres').max(100),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(128, 'Máximo 128 caracteres')
      .regex(
        PASSWORD_REGEX,
        'Debe incluir mayúscula, minúscula, número y carácter especial (@$!%*?&)',
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type ActivateForm = z.infer<typeof activateSchema>;

export default function ActivateScreen() {
  const router = useRouter();
  const { token: urlToken } = useLocalSearchParams<{ token?: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const loginWithSession = useAuthStore((s) => s.loginWithSession);

  const { control, handleSubmit, formState: { errors } } = useForm<ActivateForm>({
    resolver: zodResolver(activateSchema),
    defaultValues: {
      token: urlToken ?? '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ActivateForm) => {
    setIsLoading(true);
    try {
      // 1. Accept invitation — creates Supabase auth user, no tokens returned
      const { user } = await AuthService.activate({
        token: values.token,
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password,
      });

      // 2. Auto-login to get session tokens
      const { session } = await AuthService.login({
        email: user.email,
        password: values.password,
      });

      await loginWithSession(user, session.accessToken, session.refreshToken);
      router.replace('/(app)/(tabs)/home');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Token inválido o expirado.';
      Alert.alert('Error de activación', Array.isArray(message) ? message[0] : message);
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
          contentContainerClassName="flex-grow px-6"
          keyboardShouldPersistTaps="handled"
        >
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 self-start"
            onPress={() => router.back()}
          >
            ← Volver
          </Button>

          <View className="pt-8 pb-8">
            <Text className="text-2xl text-text-primary mb-2" style={{ fontFamily: 'Inter_700Bold' }}>
              Activar cuenta
            </Text>
            <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
              Ingresa el token recibido por email y completa tu perfil.
            </Text>
          </View>

          <View className="gap-y-4">
            <Controller
              control={control}
              name="token"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Token de activación"
                  placeholder="Pega el token aquí"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.token?.message}
                />
              )}
            />

            <View className="flex-row gap-x-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="firstName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Nombre"
                      placeholder="María"
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
                      placeholder="García"
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

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Contraseña"
                  placeholder="Mínimo 8 caracteres"
                  secureTextEntry
                  returnKeyType="next"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.password?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirmar contraseña"
                  placeholder="Repite la contraseña"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.confirmPassword?.message}
                />
              )}
            />

            {/* Password hint */}
            <View className="bg-surface-secondary rounded-xl px-4 py-3 border border-border">
              <Text className="text-text-muted text-xs leading-5" style={{ fontFamily: 'Inter_400Regular' }}>
                La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y un símbolo (@$!%*?&).
              </Text>
            </View>

            <Button fullWidth loading={isLoading} onPress={handleSubmit(onSubmit)} size="lg">
              Activar cuenta
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
