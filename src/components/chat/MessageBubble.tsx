import { View, Text } from 'react-native';
import { format } from 'date-fns';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const isOptimistic = message.id.startsWith('optimistic-');

  return (
    <View className={`flex-row mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <View className="w-8 h-8 bg-primary-100 rounded-full items-center justify-center mr-2 self-end mb-1">
          <Text className="text-primary-700 text-xs font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
            {message.senderName?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}

      <View className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <Text className="text-text-muted text-xs mb-1 ml-1" style={{ fontFamily: 'Inter_400Regular' }}>
            {message.senderName}
          </Text>
        )}
        <View
          className={`rounded-2xl px-4 py-2.5
            ${isOwn
              ? 'bg-primary-500 rounded-tr-sm'
              : 'bg-surface-secondary border border-border rounded-tl-sm'
            }
            ${isOptimistic ? 'opacity-60' : ''}`}
        >
          <Text
            className={`text-sm ${isOwn ? 'text-white' : 'text-text-primary'}`}
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {message.content}
          </Text>
        </View>
        <Text className="text-text-muted text-[10px] mt-1 mx-1" style={{ fontFamily: 'Inter_400Regular' }}>
          {format(new Date(message.createdAt), 'HH:mm')}
          {isOwn && message.readAt && ' · Leído'}
        </Text>
      </View>
    </View>
  );
}
