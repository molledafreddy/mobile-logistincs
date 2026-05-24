import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, FlatList, Keyboard,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { GeocodingService } from '../../services/api/geocoding.service';
import type { GeocodeFeature } from '../../types';

interface AddressSearchInputProps {
  label?: string;
  placeholder?: string;
  initialValue?: string;
  onSelect: (feature: GeocodeFeature) => void;
  proximity?: { lat: number; lng: number };
  country?: string;
}

export function AddressSearchInput({
  label,
  placeholder,
  initialValue = '',
  onSelect,
  proximity,
  country,
}: AddressSearchInputProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(inputValue.trim()), 400);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: features, isFetching } = useQuery({
    queryKey: ['geocoding', 'search', debouncedQuery, proximity?.lat, proximity?.lng, country],
    queryFn: () => GeocodingService.search(debouncedQuery, { limit: 5, proximity, country }),
    enabled: debouncedQuery.length >= 3,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const handleSelect = (feature: GeocodeFeature) => {
    setInputValue(feature.formatted);
    setIsOpen(false);
    Keyboard.dismiss();
    onSelect(feature);
  };

  const handleClear = () => {
    setInputValue('');
    setDebouncedQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const showDropdown = isOpen && debouncedQuery.length >= 3 && (isFetching || (features && features.length > 0));

  return (
    <View>
      {label && (
        <Text className="text-sm text-text-secondary font-medium mb-1.5" style={{ fontFamily: 'Inter_500Medium' }}>
          {label}
        </Text>
      )}

      <View className="flex-row items-center border border-border rounded-xl bg-white px-3 h-12">
        <Text className="text-base mr-2">🔍</Text>
        <TextInput
          ref={inputRef}
          className="flex-1 text-text-primary text-sm"
          style={{ fontFamily: 'Inter_400Regular' }}
          placeholder={placeholder ?? 'Buscar dirección...'}
          placeholderTextColor="#94a3b8"
          value={inputValue}
          onChangeText={(v) => { setInputValue(v); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {isFetching
          ? <ActivityIndicator size="small" color="#22c55e" />
          : inputValue.length > 0
          ? (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text className="text-text-muted text-base">✕</Text>
            </TouchableOpacity>
          )
          : null
        }
      </View>

      {showDropdown && (
        <View className="z-50 bg-white border border-border rounded-xl mt-1 overflow-hidden shadow-md">
          {isFetching && (!features || features.length === 0) ? (
            <View className="px-4 py-3 flex-row items-center gap-x-2">
              <ActivityIndicator size="small" color="#22c55e" />
              <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                Buscando...
              </Text>
            </View>
          ) : (
            <FlatList
              data={features}
              keyExtractor={(item) => item.placeId}
              scrollEnabled={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => {
                const [mainPart, ...restParts] = item.formatted.split(',');
                const subPart = restParts.join(',').trim();
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect(item)}
                    className={`px-4 py-3 ${index < (features?.length ?? 0) - 1 ? 'border-b border-border' : ''}`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className="text-text-primary text-sm font-medium"
                      numberOfLines={1}
                      style={{ fontFamily: 'Inter_500Medium' }}
                    >
                      {mainPart}
                    </Text>
                    {subPart.length > 0 && (
                      <Text
                        className="text-text-muted text-xs mt-0.5"
                        numberOfLines={1}
                        style={{ fontFamily: 'Inter_400Regular' }}
                      >
                        {subPart}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
