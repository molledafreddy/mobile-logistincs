import { create } from 'zustand';

interface UIState {
  unreadNotifications: number;
  unreadMessages: number;
  setUnreadNotifications: (count: number) => void;
  setUnreadMessages: (count: number) => void;
  incrementUnreadNotifications: () => void;
  incrementUnreadMessages: () => void;
  decrementUnreadMessages: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  unreadNotifications: 0,
  unreadMessages: 0,

  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
  setUnreadMessages: (count) => set({ unreadMessages: count }),
  incrementUnreadNotifications: () =>
    set((s) => ({ unreadNotifications: s.unreadNotifications + 1 })),
  incrementUnreadMessages: () =>
    set((s) => ({ unreadMessages: s.unreadMessages + 1 })),
  decrementUnreadMessages: () =>
    set((s) => ({ unreadMessages: Math.max(0, s.unreadMessages - 1) })),
}));
