import { useEffect, useState, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { NetInfoService as NetInfo } from '../../services/netinfo';
import { OfflineQueue } from '../../services/offline/offline-queue.service';
import { SocketService } from '../../services/socket/socket.service';

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const translateY = useRef(new Animated.Value(-60)).current;
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const slide = (visible: boolean) =>
      Animated.spring(translateY, {
        toValue: visible ? 0 : -60,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected || !state.isInternetReachable;

      setIsOffline(offline);

      if (offline) {
        wasOfflineRef.current = true;
        slide(true);
      } else {
        // Volvió la conexión
        if (wasOfflineRef.current) {
          wasOfflineRef.current = false;
          setShowReconnected(true);
          // Reconectar socket y vaciar cola offline
          SocketService.connect().catch(() => undefined);
          OfflineQueue.flush().catch(() => undefined);

          // Mostrar banner verde brevemente y ocultar
          slide(true);
          setTimeout(() => {
            slide(false);
            setTimeout(() => setShowReconnected(false), 400);
          }, 2500);
        } else {
          slide(false);
        }
      }
    });

    return unsubscribe;
  }, [translateY]);

  if (!isOffline && !showReconnected) return null;

  return (
    <Animated.View
      style={{ transform: [{ translateY }] }}
      className={`absolute top-0 left-0 right-0 z-50 py-3 px-4 items-center
        ${showReconnected && !isOffline ? 'bg-primary-500' : 'bg-slate-800'}`}
    >
      <View className="flex-row items-center gap-x-2">
        <Text className="text-lg">{showReconnected && !isOffline ? '✅' : '📡'}</Text>
        <Text className="text-white text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
          {showReconnected && !isOffline
            ? 'Conexión restaurada'
            : 'Sin conexión · modo offline'}
        </Text>
      </View>
    </Animated.View>
  );
}
