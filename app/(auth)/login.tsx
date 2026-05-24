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
import { useAuthStore } from '../../src/stores/auth.store';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginForm) => {
    setIsLoading(true);
    try {
      await login(values.email, values.password);
      router.replace('/(app)/(tabs)/home');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Credenciales incorrectas. Intenta de nuevo.';
      Alert.alert('Error de acceso', Array.isArray(message) ? message[0] : message);
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
          {/* Header */}
          <View className="items-center pt-16 pb-12">
            <View className="w-20 h-20 bg-primary-500 rounded-3xl items-center justify-center mb-6 shadow-lg">
              <Text className="text-4xl">🚛</Text>
            </View>
            <Text
              className="text-3xl text-text-primary mb-2"
              style={{ fontFamily: 'Inter_700Bold' }}
            >
              Logistics
            </Text>
            <Text
              className="text-text-secondary text-base text-center"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Inicia sesión para continuar
            </Text>
          </View>

          {/* Form */}
          <View className="gap-y-4">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Correo electrónico"
                  placeholder="conductor@empresa.com"
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

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Contraseña"
                  placeholder="••••••••"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.password?.message}
                />
              )}
            />

            <Button
              fullWidth
              loading={isLoading}
              onPress={handleSubmit(onSubmit)}
              size="lg"
            >
              Iniciar sesión
            </Button>
          </View>

          {/* Auth links */}
          <View className="items-center mt-8 gap-y-3">
            <Text
              className="text-text-secondary text-sm"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              ¿No tienes cuenta?{' '}
              <Text
                className="text-primary-600 font-medium"
                style={{ fontFamily: 'Inter_500Medium' }}
                onPress={() => router.push('/(auth)/register')}
              >
                Regístrate
              </Text>
            </Text>
            <Text
              className="text-text-secondary text-sm"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              ¿Invitado por tu empresa?{' '}
              <Text
                className="text-primary-600 font-medium"
                style={{ fontFamily: 'Inter_500Medium' }}
                onPress={() => router.push('/(auth)/activate')}
              >
                Activa tu cuenta
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
