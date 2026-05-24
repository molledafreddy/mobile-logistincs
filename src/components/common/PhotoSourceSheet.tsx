import { useCallback } from 'react';
import { View, Text } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  TouchableOpacity,
} from '@gorhom/bottom-sheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';

interface PhotoSourceSheetProps {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  onCamera: () => void;
  onGallery: () => void;
}

export function PhotoSourceSheet({ sheetRef, onCamera, onGallery }: PhotoSourceSheetProps) {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
    ),
    []
  );

  const pick = (fn: () => void) => {
    sheetRef.current?.dismiss();
    fn();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: '#cbd5e1', width: 36 }}
    >
      <BottomSheetView className="px-5 pb-10 pt-2">
        <Text
          className="text-text-primary text-base font-bold mb-4"
          style={{ fontFamily: 'Inter_700Bold' }}
        >
          Agregar foto
        </Text>

        <TouchableOpacity
          className="flex-row items-center py-4 border-b border-border"
          onPress={() => pick(onCamera)}
          activeOpacity={0.7}
        >
          <View className="w-11 h-11 bg-primary-100 rounded-xl items-center justify-center mr-4">
            <Text className="text-2xl">📸</Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-text-primary font-medium"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              Tomar foto
            </Text>
            <Text
              className="text-text-muted text-xs mt-0.5"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Usa la cámara del dispositivo
            </Text>
          </View>
          <Text className="text-text-muted">›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center py-4"
          onPress={() => pick(onGallery)}
          activeOpacity={0.7}
        >
          <View className="w-11 h-11 bg-surface-tertiary rounded-xl items-center justify-center mr-4">
            <Text className="text-2xl">🖼</Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-text-primary font-medium"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              Seleccionar de galería
            </Text>
            <Text
              className="text-text-muted text-xs mt-0.5"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Elige una foto existente
            </Text>
          </View>
          <Text className="text-text-muted">›</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
