import { io, Socket } from 'socket.io-client';
import { StorageService } from '../storage/storage.service';
import { SocketEvent } from './socket.events';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';

// Singleton socket — one connection for the lifetime of the session
let socket: Socket | null = null;

export const SocketService = {
  async connect(): Promise<void> {
    if (socket?.connected) return;

    const token = await StorageService.getAccessToken();

    return new Promise((resolve) => {
      socket = io(BASE_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 10_000,
      });

      socket.once('connect', resolve);
      socket.once('connect_error', () => resolve()); // resolve anyway, reconnection handles retry
    });
  },

  disconnect(): void {
    socket?.disconnect();
    socket = null;
  },

  on<T = unknown>(event: SocketEvent, handler: (data: T) => void): () => void {
    socket?.on(event, handler);
    return () => socket?.off(event, handler);
  },

  emit<T = unknown>(event: SocketEvent, data: T): void {
    socket?.emit(event, data);
  },

  isConnected(): boolean {
    return socket?.connected ?? false;
  },
};
