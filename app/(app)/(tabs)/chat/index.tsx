import { useEffect } from 'react';
import { FlatList, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatService } from '../../../../src/services/api/chat.service';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import { useUIStore } from '../../../../src/stores/ui.store';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Conversation } from '../../../../src/types';

function ConversationItem({ conversation }: { conversation: Conversation }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-4 border-b border-border"
      onPress={() => router.push(`/(app)/(tabs)/chat/${conversation.id}`)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View className="relative mr-3">
        <View className="w-12 h-12 bg-primary-100 rounded-full items-center justify-center">
          <Text className="text-text-primary font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
            {conversation.participantName.charAt(0).toUpperCase()}
          </Text>
        </View>
        {conversation.isOnline && (
          <View className="absolute bottom-0 right-0 w-3 h-3 bg-primary-500 rounded-full border-2 border-white" />
        )}
      </View>

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
            {conversation.participantName}
          </Text>
          {conversation.lastMessageAt && (
            <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              {format(new Date(conversation.lastMessageAt), "HH:mm", { locale: es })}
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-text-muted text-sm flex-1 mr-2" numberOfLines={1} style={{ fontFamily: 'Inter_400Regular' }}>
            {conversation.lastMessage ?? 'Sin mensajes'}
          </Text>
          {conversation.unreadCount > 0 && (
            <View className="bg-primary-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
              <Text className="text-white text-xs font-bold">
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ChatListSkeleton() {
  return (
    <View className="px-4 pt-2">
      {[1, 2, 3, 4].map((i) => (
        <View key={i} className="flex-row items-center py-4 border-b border-border">
          <Skeleton width={48} height={48} borderRadius={24} style={{ marginRight: 12 }} />
          <View className="flex-1 gap-y-2">
            <Skeleton height={14} width="50%" />
            <Skeleton height={12} width="80%" />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const setUnreadMessages = useUIStore((s) => s.setUnreadMessages);

  useEffect(() => {
    setUnreadMessages(0);
  }, []);

  const { data: conversations = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: ChatService.getConversations,
    refetchInterval: 15_000,
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-4 pb-3 border-b border-border">
        <Text className="text-2xl text-text-primary" style={{ fontFamily: 'Inter_700Bold' }}>
          Mensajes
          {conversations.length > 0 && (
            <Text className="text-text-muted text-lg"> ({conversations.length})</Text>
          )}
        </Text>
      </View>

      {isLoading ? (
        <ChatListSkeleton />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" />
          }
          renderItem={({ item }) => <ConversationItem conversation={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="💬"
              title="Sin conversaciones"
              description="Cuando alguien te escriba, aparecerá aquí."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
