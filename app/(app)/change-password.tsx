import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { AuthService } from '../../src/services/api/auth.service';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(72, 'Máximo 72 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma la nueva contraseña'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordScreen() {
  const router = useRouter();

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      AuthService.changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      Alert.alert(
        'Contraseña actualizada',
        'Tu contraseña se cambió correctamente.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ??
        'No se pudo cambiar la contraseña. Verifica tu contraseña actual.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

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
          <View className="flex-row items-center pt-6 pb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-9 h-9 bg-surface-secondary rounded-full items-center justify-center border border-border mr-3"
            >
              <Text className="text-text-primary">←</Text>
            </TouchableOpacity>
            <View>
              <Text
                className="text-text-primary text-xl font-bold"
                style={{ fontFamily: 'Inter_700Bold' }}
              >
                Cambiar contraseña
              </Text>
              <Text
                className="text-text-muted text-sm"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                Elige una contraseña segura
              </Text>
            </View>
          </View>

          <View className="gap-y-4">
            <Controller
              control={control}
              name="currentPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Contraseña actual"
                  placeholder="••••••••"
                  secureTextEntry
                  returnKeyType="next"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.currentPassword?.message}
                />
              )}
            />

            <View className="h-px bg-border" />

            <Controller
              control={control}
              name="newPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nueva contraseña"
                  placeholder="••••••••"
                  secureTextEntry
                  returnKeyType="next"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.newPassword?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirmar nueva contraseña"
                  placeholder="••••••••"
                  secureTextEntry
                  returnKeyType="done"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.confirmPassword?.message}
                />
              )}
            />
          </View>

          {/* Hint */}
          <View className="bg-surface-secondary rounded-2xl px-4 py-3 mt-5 border border-border">
            <Text
              className="text-text-secondary text-xs leading-5"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              La nueva contraseña debe tener al menos 8 caracteres. Usa una combinación de letras, números y símbolos para mayor seguridad.
            </Text>
          </View>

          <Button
            fullWidth
            size="lg"
            loading={mutation.isPending}
            onPress={handleSubmit((v) => mutation.mutate(v))}
            className="mt-6"
          >
            Actualizar contraseña
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
