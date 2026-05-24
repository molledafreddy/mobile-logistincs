import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NetInfoService as NetInfo } from '../../services/netinfo';
import { ChatService } from '../../services/api/chat.service';
import { SocketService } from '../../services/socket/socket.service';
import { SocketEvent } from '../../services/socket/socket.events';
import { OfflineQueue } from '../../services/offline/offline-queue.service';
import { useAuthStore } from '../../stores/auth.store';
import type { Message } from '../../types';

export function useChat(conversationId: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const queryKey = ['chat', 'messages', conversationId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => ChatService.getMessages(conversationId, { limit: 30 }),
    select: (d) => [...d.data].reverse(), // oldest first
  });

  // Mark conversation as read on mount
  useEffect(() => {
    ChatService.markConversationRead(conversationId).catch(() => undefined);
    queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
  }, [conversationId, queryClient]);

  // Append incoming messages from WebSocket
  useEffect(() => {
    const unsub = SocketService.on<Message>(SocketEvent.NEW_MESSAGE, (msg) => {
      if (msg.conversationId !== conversationId) return;
      queryClient.setQueryData<Message[]>(queryKey, (prev = []) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return unsub;
  }, [conversationId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        // Encolar y devolver el optimistic message como respuesta
        const tempId = `optimistic-${Date.now()}`;
        OfflineQueue.enqueueMessage({ conversationId, content, tempId });
        return null;
      }
      return ChatService.sendMessage(conversationId, content);
    },
    onMutate: async (content) => {
      // Optimistic update — visible tanto online como offline
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId,
        senderId: user?.id ?? '',
        senderName: `${user?.firstName} ${user?.lastName}`,
        content,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      queryClient.setQueryData<Message[]>(queryKey, (prev = []) => [...prev, optimisticMsg]);
      return { optimisticMsg };
    },
    onSuccess: (serverMsg, _, context) => {
      if (!serverMsg) {
        // Offline: el mensaje queda marcado como pending (se enviará al reconectar)
        queryClient.setQueryData<Message[]>(queryKey, (prev = []) =>
          prev.map((m) =>
            m.id === context?.optimisticMsg.id ? { ...m, pending: true } : m
          )
        );
        return;
      }
      // Online: reemplazar optimistic con el mensaje real del servidor
      queryClient.setQueryData<Message[]>(queryKey, (prev = []) =>
        prev.map((m) => (m.id === context?.optimisticMsg.id ? { ...serverMsg, pending: false } : m))
      );
    },
    onError: (_, __, context) => {
      // Error de red inesperado: eliminar el optimistic
      queryClient.setQueryData<Message[]>(queryKey, (prev = []) =>
        prev.filter((m) => m.id !== context?.optimisticMsg.id)
      );
    },
  });

  const send = useCallback((content: string) => {
    if (!content.trim()) return;
    sendMutation.mutate(content.trim());
  }, [sendMutation]);

  return {
    messages: data ?? [],
    isLoading,
    send,
    isSending: sendMutation.isPending,
    currentUserId: user?.id,
  };
}
