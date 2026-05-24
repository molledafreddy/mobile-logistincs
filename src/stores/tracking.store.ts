import { create } from 'zustand';
import { LocationService } from '../services/location/location.service';
import type { LocationUpdate } from '../types';

interface TrackingState {
  isTracking: boolean;
  activeRunId: string | null;
  lastLocation: LocationUpdate | null;
  speed: number;

  startTracking: (runId: string) => Promise<void>;
  stopTracking: () => Promise<void>;
  updateLocation: (location: LocationUpdate) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  isTracking: false,
  activeRunId: null,
  lastLocation: null,
  speed: 0,

  startTracking: async (runId) => {
    await LocationService.startTracking(runId);
    set({ isTracking: true, activeRunId: runId });
  },

  stopTracking: async () => {
    await LocationService.stopTracking();
    set({ isTracking: false, activeRunId: null, lastLocation: null });
  },

  updateLocation: (location) => {
    set({ lastLocation: location, speed: location.speed ?? 0 });
  },
}));
