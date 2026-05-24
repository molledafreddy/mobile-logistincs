import { useState } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { Button } from '../ui/Button';

interface Props {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  runName: string;
  isLoading: boolean;
  onConfirm: (reason: string) => void;
}

export function CancelRunSheet({ sheetRef, runName, isLoading, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = reason.trim();
  const tooShort = trimmed.length < 3;
  const tooLong = trimmed.length > 500;
  const error =
    touched && tooShort
      ? 'Mínimo 3 caracteres'
      : touched && tooLong
        ? 'Máximo 500 caracteres'
        : undefined;

  const handleConfirm = () => {
    setTouched(true);
    if (tooShort || tooLong) return;
    onConfirm(trimmed);
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['50%']}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
      backgroundStyle={{ backgroundColor: '#fff' }}
      keyboardBehavior={Platform.OS === 'ios' ? 'extend' : 'interactive'}
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text
          className="text-text-primary text-lg font-bold mb-1 mt-1"
          style={{ fontFamily: 'Inter_700Bold' }}
        >
          Cancelar run
        </Text>
        <Text
          className="text-text-secondary text-sm mb-5"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          «{runName}» — Esta acción no se puede deshacer.
        </Text>

        <Text
          className="text-sm text-text-secondary mb-1.5"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          Motivo de cancelación
        </Text>
        <TextInput
          multiline
          numberOfLines={4}
          placeholder="Describe el motivo de la cancelación…"
          placeholderTextColor="#9ca3af"
          value={reason}
          onChangeText={setReason}
          onBlur={() => setTouched(true)}
          style={{
            borderWidth: 1,
            borderColor: error ? '#ef4444' : '#e5e7eb',
            borderRadius: 12,
            padding: 12,
            height: 100,
            textAlignVertical: 'top',
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: '#111827',
          }}
        />
        {error && (
          <Text
            className="text-red-500 text-xs mt-1"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {error}
          </Text>
        )}
        <Text
          className="text-text-muted text-xs mt-1 text-right"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          {trimmed.length}/500
        </Text>

        <Button
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleConfirm}
          className="mt-4 bg-red-500"
        >
          Confirmar cancelación
        </Button>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
