import { apiClient } from './client';
import type { LocationUpdate } from '../../types';

function locationToPoint(loc: LocationUpdate) {
  return {
    lat: String(loc.lat),
    lng: String(loc.lng),
    ...(loc.speed != null && { speed: String(loc.speed) }),
    ...(loc.heading != null && { heading: String(loc.heading) }),
    ...(loc.accuracy != null && { accuracy: String(loc.accuracy) }),
    ...(loc.timestamp && { capturedAt: new Date(loc.timestamp).toISOString() }),
  };
}

export const TrackingService = {
  // runId is kept as a parameter for context (offline queue, location service)
  // but is not sent to the API — the server identifies the driver from the JWT.
  async sendLocation(_runId: string, location: LocationUpdate): Promise<void> {
    await apiClient.post('/tracking/points', locationToPoint(location));
  },

  async sendLocationBulk(locations: LocationUpdate[]): Promise<void> {
    await apiClient.post('/tracking/points/bulk', {
      points: locations.map(locationToPoint),
    });
  },
};
