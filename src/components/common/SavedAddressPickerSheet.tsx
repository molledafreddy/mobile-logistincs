import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useQuery } from '@tanstack/react-query';
import { SavedAddressesService } from '../../services/api/saved-addresses.service';
import type { SavedAddress, SavedAddressKind } from '../../types';

const KIND_CONFIG: Record<SavedAddressKind | 'all', { label: string; icon: string }> = {
  all:      { label: 'Todos',    icon: '🗂' },
  depot:    { label: 'Depósito', icon: '🏭' },
  customer: { label: 'Cliente',  icon: '👤' },
  dropoff:  { label: 'Entrega',  icon: '📥' },
  pickup:   { label: 'Recogida', icon: '📤' },
  other:    { label: 'Otro',     icon: '📍' },
};

const SNAP_POINTS = ['65%', '92%'];

interface Props {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  onSelect: (address: SavedAddress) => void;
}

export function SavedAddressPickerSheet({ sheetRef, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [activeKind, setActiveKind] = useState<SavedAddressKind | 'all'>('all');

  const queryParams = {
    q: search.trim().length >= 2 ? search.trim() : undefined,
    kind: activeKind !== 'all' ? activeKind : undefined,
    limit: 60,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['saved-addresses', queryParams],
    queryFn: () => SavedAddressesService.getAll(queryParams),
    staleTime: 60_000,
  });

  const addresses = data?.data ?? [];

  const handleSelect = useCallback(
    (addr: SavedAddress) => {
      setSearch('');
      setActiveKind('all');
      sheetRef.current?.dismiss();
      onSelect(addr);
    },
    [sheetRef, onSelect],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: '#cbd5e1' }}
      backgroundStyle={{ backgroundColor: '#ffffff' }}
    >
      {/* Header */}
      <View className="px-4 pb-3 border-b border-border">
        <Text className="text-text-primary text-base font-bold mb-3" style={{ fontFamily: 'Inter_700Bold' }}>
          Seleccionar dirección guardada
        </Text>

        {/* Search bar */}
        <View className="flex-row items-center bg-surface-secondary rounded-xl px-3 h-11 border border-border mb-3">
          <Text className="text-base mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-text-primary text-sm"
            style={{ fontFamily: 'Inter_400Regular' }}
            placeholder="Buscar por nombre o dirección..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text className="text-text-muted">✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Kind pills */}
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(KIND_CONFIG) as (SavedAddressKind | 'all')[]).map((k) => {
            const cfg = KIND_CONFIG[k];
            const isActive = activeKind === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setActiveKind(k)}
                className={`flex-row items-center px-3 py-1.5 rounded-full border ${
                  isActive ? 'bg-primary-500 border-primary-500' : 'bg-white border-border'
                }`}
              >
                <Text className="text-xs mr-1">{cfg.icon}</Text>
                <Text
                  className={`text-xs font-medium ${isActive ? 'text-white' : 'text-text-secondary'}`}
                  style={{ fontFamily: 'Inter_500Medium' }}
                >
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
            Cargando...
          </Text>
        </View>
      ) : addresses.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-3xl mb-3">📍</Text>
          <Text className="text-text-primary font-semibold text-center mb-1" style={{ fontFamily: 'Inter_600SemiBold' }}>
            {search.length >= 2 ? 'Sin resultados' : 'Sin direcciones guardadas'}
          </Text>
          <Text className="text-text-muted text-sm text-center" style={{ fontFamily: 'Inter_400Regular' }}>
            {search.length >= 2
              ? `No se encontraron favoritos para "${search}"`
              : 'Agrega direcciones frecuentes en la sección de favoritos.'}
          </Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text className="text-text-muted text-xs mb-2" style={{ fontFamily: 'Inter_400Regular' }}>
              {addresses.length} dirección{addresses.length !== 1 ? 'es' : ''}
            </Text>
          }
          renderItem={({ item }) => {
            const kind = KIND_CONFIG[item.kind] ?? KIND_CONFIG.other;
            return (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                activeOpacity={0.75}
                className="flex-row items-start bg-surface-secondary border border-border rounded-2xl px-4 py-3.5 mb-2.5"
              >
                <View className="w-9 h-9 bg-white rounded-xl border border-border items-center justify-center mr-3 mt-0.5">
                  <Text className="text-lg">{kind.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="text-text-primary font-semibold text-sm mb-0.5"
                    numberOfLines={1}
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    className="text-text-secondary text-xs"
                    numberOfLines={2}
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    {item.formatted}
                  </Text>
                  {item.notes && (
                    <Text
                      className="text-text-muted text-xs mt-1"
                      numberOfLines={1}
                      style={{ fontFamily: 'Inter_400Regular' }}
                    >
                      📝 {item.notes}
                    </Text>
                  )}
                </View>
                <Text className="text-text-muted text-base ml-2 mt-1">›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </BottomSheetModal>
  );
}
