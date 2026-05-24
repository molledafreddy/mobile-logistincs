import { View, Text } from 'react-native';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

export function EmptyState({ title, description, actionLabel, onAction, icon = '📭' }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-text-primary text-lg font-semibold text-center mb-2" style={{ fontFamily: 'Inter_600SemiBold' }}>
        {title}
      </Text>
      {description && (
        <Text className="text-text-muted text-sm text-center mb-6" style={{ fontFamily: 'Inter_400Regular' }}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button onPress={onAction}>{actionLabel}</Button>
      )}
    </View>
  );
}
