import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { SocketService } from '../socket/socket.service';
import { TrackingService } from '../api/tracking.service';
import { OfflineQueue } from '../offline/offline-queue.service';
import { SocketEvent } from '../socket/socket.events';
import { StorageService } from '../storage/storage.service';
import type { LocationUpdate } from '../../types';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';
const ACTIVE_RUN_KEY = 'active_run_id';

// Background task — defined at module level (required by expo-task-manager)
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error || !data?.locations?.length) return;

    const activeRunId = StorageService.get(ACTIVE_RUN_KEY);
    if (!activeRunId) return;

    const loc = data.locations[0];
    const update: LocationUpdate = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      speed: loc.coords.speed ?? undefined,
      heading: loc.coords.heading ?? undefined,
      accuracy: loc.coords.accuracy ?? undefined,
      timestamp: loc.timestamp,
    };

    if (SocketService.isConnected()) {
      SocketService.emit(SocketEvent.LOCATION_UPDATE, { runId: activeRunId, ...update });
    } else {
      try {
        await TrackingService.sendLocation(activeRunId, update);
      } catch {
        OfflineQueue.enqueueLocation(activeRunId, update);
      }
    }
  }
);

export const LocationService = {
  async requestPermissions(): Promise<boolean> {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    return fg === 'granted';
  },

  async startTracking(runId: string): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) throw new Error('Location permission denied');

    StorageService.set(ACTIVE_RUN_KEY, runId);

    try {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 15_000,
        distanceInterval: 50,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Tracking activo',
          notificationBody: 'Tu ubicación se está compartiendo con el despachador.',
          notificationColor: '#22c55e',
        },
      });
    } catch {
      // Background task requires "allow all the time" permission.
      // If not granted, the task won't run in background but foreground tracking still works.
    }
  },

  async stopTracking(): Promise<void> {
    StorageService.delete(ACTIVE_RUN_KEY);
    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  },

  async isTracking(): Promise<boolean> {
    return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  },

  async getCurrentLocation(): Promise<Location.LocationObject> {
    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  },
};
