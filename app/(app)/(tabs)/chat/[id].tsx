import { useRef, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ChatService } from '../../../../src/services/api/chat.service';
import { useChat } from '../../../../src/features/chat/useChat';
import { MessageBubble } from '../../../../src/components/chat/MessageBubble';
import type { Message } from '../../../../src/types';

export default function ChatConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: ChatService.getConversations,
  });
  const conversation = conversations.find((c) => c.id === id);

  const { messages, isLoading, send, isSending, currentUserId } = useChat(id);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    send(text.trim());
    setText('');
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-primary-600 font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
            ←
          </Text>
        </TouchableOpacity>

        <View className="w-9 h-9 bg-primary-100 rounded-full items-center justify-center mr-3">
          <Text className="text-primary-700 font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
            {conversation?.participantName?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>

        <View className="flex-1">
          <Text className="text-text-primary font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
            {conversation?.participantName ?? 'Conversación'}
          </Text>
          {conversation?.isOnline && (
            <Text className="text-primary-500 text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              En línea
            </Text>
          )}
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#22c55e" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerClassName="px-4 py-4 flex-grow justify-end"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwn={item.senderId === currentUserId}
              />
            )}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-12">
                <Text className="text-4xl mb-3">💬</Text>
                <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                  Sé el primero en escribir
                </Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View className="flex-row items-end px-4 py-3 border-t border-border bg-white">
          <TextInput
            className="flex-1 bg-surface-secondary rounded-2xl px-4 py-3 text-text-primary text-sm mr-3 max-h-28"
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#94a3b8"
            value={text}
            onChangeText={setText}
            multiline
            returnKeyType="default"
            style={{ fontFamily: 'Inter_400Regular' }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || isSending}
            className={`w-11 h-11 rounded-full items-center justify-center
              ${text.trim() && !isSending ? 'bg-primary-500' : 'bg-surface-tertiary'}`}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#22c55e" />
            ) : (
              <Text className={`text-base font-bold ${text.trim() ? 'text-white' : 'text-text-muted'}`}>
                ➤
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
