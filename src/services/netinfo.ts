import { Platform } from 'react-native';

type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

type NetInfoChangeHandler = (state: NetInfoState) => void;

// Safe wrapper for @react-native-community/netinfo.
// In React Native new architecture (JSI), NativeEventEmitter(module) crashes
// if the module hasn't been updated to the TurboModule EventEmitter spec.
// We lazy-load and wrap in try/catch so failures are non-fatal.

let _NetInfo: typeof import('@react-native-community/netinfo').default | null = null;

function getNetInfo() {
  if (_NetInfo) return _NetInfo;
  try {
    _NetInfo = require('@react-native-community/netinfo').default;
  } catch {
    _NetInfo = null;
  }
  return _NetInfo;
}

export const NetInfoService = {
  addEventListener(handler: NetInfoChangeHandler): () => void {
    const netInfo = getNetInfo();
    if (!netInfo) return () => {};
    try {
      return netInfo.addEventListener(handler as any);
    } catch {
      return () => {};
    }
  },

  async fetch(): Promise<NetInfoState> {
    const netInfo = getNetInfo();
    if (!netInfo) return { isConnected: true, isInternetReachable: true };
    try {
      const state = await netInfo.fetch();
      return {
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
      };
    } catch {
      return { isConnected: true, isInternetReachable: true };
    }
  },
};
