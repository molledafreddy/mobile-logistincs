import { View, Text } from 'react-native';
import type { DeliveryRun } from '../../types';

interface RunProgressBarProps {
  run: DeliveryRun;
}

export function RunProgressBar({ run }: RunProgressBarProps) {
  const { completedStops, totalStops } = run;
  const pct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

  return (
    <View className="bg-white border border-border rounded-2xl p-4 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-text-primary font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
          Progreso del run
        </Text>
        <Text className="text-primary-600 font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
          {completedStops}/{totalStops} paradas
        </Text>
      </View>

      <View className="h-3 bg-surface-tertiary rounded-full overflow-hidden mb-2">
        <View
          className="h-full bg-primary-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </View>

      <View className="flex-row justify-between">
        <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
          {pct.toFixed(0)}% completado
        </Text>
        {run.status === 'in_progress' && run.completedStops < run.totalStops && (
          <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            {totalStops - completedStops} restantes
          </Text>
        )}
      </View>
    </View>
  );
}
