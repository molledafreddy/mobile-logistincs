import { apiClient } from './client';
import type { Conversation, Message, PaginatedResponse } from '../../types';

export const ChatService = {
  async getConversations(): Promise<Conversation[]> {
    const { data } = await apiClient.get<Conversation[]>('/chat/conversations');
    return data;
  },

  async getMessages(conversationId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Message>> {
    const { data } = await apiClient.get<PaginatedResponse<Message>>(
      `/chat/conversations/${conversationId}/messages`,
      { params }
    );
    return data;
  },

  async sendMessage(conversationId: string, content: string, attachmentUrl?: string): Promise<Message> {
    const { data } = await apiClient.post<Message>(
      `/chat/conversations/${conversationId}/messages`,
      { content, attachmentUrl }
    );
    return data;
  },

  async markConversationRead(conversationId: string): Promise<void> {
    await apiClient.patch(`/chat/conversations/${conversationId}/read`);
  },
};
