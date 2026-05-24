import { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
import { ExpensesService } from '../../../../src/services/api/expenses.service';
import { OfflineQueue } from '../../../../src/services/offline/offline-queue.service';
import { useNetworkStatus } from '../../../../src/features/tracking/useNetworkStatus';
import { Input } from '../../../../src/components/ui/Input';
import { Button } from '../../../../src/components/ui/Button';
import { PhotoSourceSheet } from '../../../../src/components/common/PhotoSourceSheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import type { ExpenseCategory } from '../../../../src/types';

const CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'fuel', label: 'Combustible', icon: '⛽' },
  { value: 'toll', label: 'Peaje', icon: '🛣️' },
  { value: 'maintenance', label: 'Mantención', icon: '🔧' },
  { value: 'meal', label: 'Alimentación', icon: '🍽️' },
  { value: 'parking', label: 'Estacionamiento', icon: '🅿️' },
  { value: 'repair', label: 'Reparación', icon: '🛠️' },
  { value: 'lodging', label: 'Hospedaje', icon: '🏨' },
  { value: 'other', label: 'Otro', icon: '📋' },
];

const schema = z.object({
  category: z.enum(['fuel', 'toll', 'maintenance', 'meal', 'parking', 'repair', 'lodging', 'other'] as const),
  amount: z.string().min(1, 'Ingresa el monto').refine((v) => !isNaN(Number(v)) && Number(v) > 0, {
    message: 'Monto inválido',
  }),
  description: z.string().min(2, 'Describe el gasto (mín. 2 caracteres)'),
});

type ExpenseForm = z.infer<typeof schema>;

export default function NewExpenseScreen() {
  const queryClient = useQueryClient();
  const receiptSheetRef = useRef<BottomSheetModalMethods>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { isOnline } = useNetworkStatus();

  const { control, handleSubmit, formState: { errors } } = useForm<ExpenseForm>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'fuel', amount: '', description: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: ExpenseForm) => {
      const net = await NetInfo.fetch();

      if (!net.isConnected) {
        // Offline: encolar sin recibo (no se puede subir imagen sin conexión)
        OfflineQueue.enqueueExpense({
          category: values.category,
          amount: values.amount.trim(),
          description: values.description.trim(),
          expenseDate: new Date().toISOString().split('T')[0],
          currency: 'CLP',
        });
        return null;
      }

      let receiptUrl: string | undefined;
      if (receiptUri) {
        setIsUploading(true);
        const { url } = await ExpensesService.uploadReceipt(receiptUri);
        receiptUrl = url;
        setIsUploading(false);
      }

      return ExpensesService.createExpense({
        category: values.category,
        amount: values.amount.trim(),
        description: values.description.trim(),
        expenseDate: new Date().toISOString().split('T')[0],
        currency: 'CLP',
        receiptUrl,
      });
    },
    onSuccess: (result) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      const message = result
        ? 'Tu gasto fue guardado correctamente.'
        : 'Sin conexión — el gasto se guardará y enviará al reconectar.';
      Alert.alert('Gasto registrado', message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => {
      setIsUploading(false);
      Alert.alert('Error', 'No se pudo guardar el gasto. Intenta de nuevo.');
    },
  });

  const takeReceiptPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Activa el acceso a la cámara en Configuración.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (!result.canceled) setReceiptUri(result.assets[0].uri);
  };

  const pickReceiptFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (!result.canceled) setReceiptUri(result.assets[0].uri);
  };

  const onSubmit = (values: ExpenseForm) => mutation.mutate(values);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-primary-600 font-medium" style={{ fontFamily: 'Inter_500Medium' }}>← Cancelar</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-text-primary font-bold text-lg" style={{ fontFamily: 'Inter_700Bold' }}>
          Nuevo gasto
        </Text>
      </View>

      {!isOnline && (
        <View className="bg-slate-800 px-4 py-2 flex-row items-center gap-x-2">
          <Text className="text-base">📡</Text>
          <Text className="text-white text-xs flex-1" style={{ fontFamily: 'Inter_400Regular' }}>
            Sin conexión — el gasto se guardará y enviará al reconectar
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-5 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Category */}
          <Text className="text-sm text-text-secondary mb-3 font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
            Categoría
          </Text>
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap gap-2 mb-5">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => onChange(cat.value)}
                    className={`flex-row items-center px-4 py-2.5 rounded-xl border
                      ${value === cat.value
                        ? 'bg-primary-500 border-primary-500'
                        : 'bg-surface-secondary border-border'}`}
                  >
                    <Text className="mr-2">{cat.icon}</Text>
                    <Text
                      className={`text-sm font-medium ${value === cat.value ? 'text-white' : 'text-text-secondary'}`}
                      style={{ fontFamily: 'Inter_500Medium' }}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />

          {/* Amount */}
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Monto"
                placeholder="0.00"
                keyboardType="decimal-pad"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.amount?.message}
                className="mb-4"
              />
            )}
          />

          {/* Description */}
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Descripción"
                placeholder="Ej: Carga completa de gasolina en ruta"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="mb-5 min-h-[72px]"
              />
            )}
          />

          {/* Receipt */}
          <Text className="text-sm text-text-secondary mb-3 font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
            Foto de recibo (opcional)
          </Text>

          {receiptUri ? (
            <View className="mb-5">
              <Image source={{ uri: receiptUri }} className="w-full h-48 rounded-2xl mb-2" resizeMode="cover" />
              <Button variant="outline" size="sm" onPress={() => receiptSheetRef.current?.present()}>
                Cambiar foto
              </Button>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => receiptSheetRef.current?.present()}
              className="border-2 border-dashed border-primary-200 rounded-2xl py-8 items-center mb-5 bg-primary-50"
            >
              <Text className="text-3xl mb-2">🧾</Text>
              <Text className="text-primary-600 font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                Adjuntar recibo
              </Text>
              <Text className="text-text-muted text-xs mt-1" style={{ fontFamily: 'Inter_400Regular' }}>
                Cámara o galería
              </Text>
            </TouchableOpacity>
          )}

          <Button
            fullWidth
            size="lg"
            loading={mutation.isPending || isUploading}
            onPress={handleSubmit(onSubmit)}
          >
            {isUploading ? 'Subiendo recibo...' : 'Guardar gasto'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      <PhotoSourceSheet
        sheetRef={receiptSheetRef}
        onCamera={takeReceiptPhoto}
        onGallery={pickReceiptFromLibrary}
      />
    </SafeAreaView>
  );
}
