import { TouchableOpacity, View, Text } from 'react-native';
import { StopStatusBadge } from '../ui/Badge';
import type { RunStop } from '../../types';

interface StopCardProps {
  stop: RunStop;
  index: number;
  isActive: boolean;
  onPress: () => void;
  actionLabel?: string;
  isOptimizing?: boolean;
  isReordered?: boolean;
}

const STOP_TYPE_ICON: Record<string, string> = {
  pickup: '📤',
  dropoff: '📥',
  waypoint: '📍',
};

export function StopCard({ stop, index, isActive, onPress, actionLabel, isOptimizing, isReordered }: StopCardProps) {
  const isCompleted = stop.status === 'delivered';
  const isFailed = stop.status === 'failed';

  const cardBorder = isReordered
    ? 'bg-amber-50 border-amber-300'
    : isActive
    ? 'bg-primary-50 border-primary-200'
    : 'bg-white border-border';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className={`flex-row items-start mb-3 ${(isCompleted || isFailed) && !isReordered ? 'opacity-60' : ''} ${isOptimizing ? 'opacity-40' : ''}`}
    >
      {/* Timeline indicator */}
      <View className="items-center mr-3 pt-1">
        <View
          className={`w-8 h-8 rounded-full items-center justify-center
            ${isCompleted ? 'bg-primary-500' : isActive ? 'bg-primary-100 border-2 border-primary-500' : 'bg-surface-tertiary'}`}
        >
          {isCompleted ? (
            <Text className="text-white text-sm">✓</Text>
          ) : (
            <Text className="text-text-secondary text-xs font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
              {index + 1}
            </Text>
          )}
        </View>
      </View>

      {/* Content */}
      <View className={`flex-1 rounded-2xl p-4 border ${cardBorder}`}>
        <View className="flex-row items-start justify-between mb-1">
          <View className="flex-row items-center flex-1 mr-2">
            <Text className="mr-1.5">{STOP_TYPE_ICON[stop.type] ?? '📍'}</Text>
            <Text
              className="text-text-primary font-semibold flex-1"
              numberOfLines={1}
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              {stop.type === 'pickup' ? 'Recogida' : stop.type === 'dropoff' ? 'Entrega' : 'Parada'} #{index + 1}
            </Text>
          </View>
          <View className="flex-row items-center gap-x-1.5">
            {isReordered && (
              <View className="bg-amber-100 rounded-full px-2 py-0.5">
                <Text className="text-amber-700 text-xs font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                  ↕ nuevo orden
                </Text>
              </View>
            )}
            <StopStatusBadge status={stop.status} />
          </View>
        </View>

        {stop.description && (
          <Text
            className="text-text-primary text-sm font-medium mb-0.5"
            numberOfLines={1}
            style={{ fontFamily: 'Inter_500Medium' }}
          >
            {stop.description}
          </Text>
        )}

        <Text
          className="text-text-secondary text-xs mb-2"
          numberOfLines={2}
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          {stop.address}
        </Text>

        <View className="flex-row gap-x-4">
          {stop.contactName && (
            <View className="flex-row items-center">
              <Text className="text-xs text-text-muted mr-1">👤</Text>
              <Text className="text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
                {stop.contactName}
              </Text>
            </View>
          )}
          {stop.eta && stop.status === 'pending' && (
            <View className="flex-row items-center">
              <Text className="text-xs text-text-muted mr-1">⏱</Text>
              <Text className="text-xs text-primary-600 font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                ETA {stop.eta}
              </Text>
            </View>
          )}
          {stop.distanceKm && stop.status === 'pending' && (
            <View className="flex-row items-center">
              <Text className="text-xs text-text-muted mr-1">📏</Text>
              <Text className="text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
                {stop.distanceKm.toFixed(1)} km
              </Text>
            </View>
          )}
        </View>

        {isActive && actionLabel && (
          <View className="mt-3 bg-primary-500 rounded-xl py-2.5 items-center">
            <Text className="text-white text-sm font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
              {actionLabel}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
