import { useEffect, useState } from 'react';
import { NetInfoService } from '../../services/netinfo';

interface NetworkStatus {
  isOnline: boolean;
  isWifi: boolean;
  isCellular: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfoService.addEventListener((state) => {
      setIsConnected(state.isConnected !== false && state.isInternetReachable !== false);
    });
    NetInfoService.fetch().then((state) => {
      setIsConnected(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return {
    isOnline: isConnected !== false,
    isWifi: false,
    isCellular: false,
  };
}
