import { apiClient } from './client';
import type { DeliveryRun, PaginatedResponse, RunEtas, RunShift, RunStop, StopStatus } from '../../types';

type Shift = RunShift;

const SHIPMENT_STATUS_TO_STOP: Record<string, StopStatus> = {
  draft: 'pending', pending_acceptance: 'pending', quoted: 'pending',
  confirmed: 'pending', assigned: 'pending',
  picked_up: 'in_transit', in_transit: 'in_transit', at_stop: 'arrived',
  delivered: 'delivered', pod_uploaded: 'delivered', completed: 'delivered',
  incident: 'failed', cancelled: 'failed',
};

function mapShipmentToStop(s: any): RunStop {
  return {
    id: s.id,
    sequence: s.runSequence ?? 0,
    type: 'dropoff',
    status: SHIPMENT_STATUS_TO_STOP[s.status] ?? 'pending',
    address: s.destinationAddress,
    lat: parseFloat(s.destinationLat) || 0,
    lng: parseFloat(s.destinationLng) || 0,
    contactName: s.destinationContactName ?? undefined,
    contactPhone: s.destinationContactPhone ?? undefined,
    notes: s.notes ?? undefined,
    deliveredAt: s.deliveredAt ? String(s.deliveredAt) : undefined,
    trackingCode: s.trackingCode,
    referenceNumber: s.referenceNumber,
    description: s.description,
    weightKg: s.weightKg,
    volumeM3: s.volumeM3,
    pieces: s.pieces,
    cargoType: s.cargoType,
    priority: s.priority,
    originAddress: s.originAddress,
    originContactName: s.originContactName,
    originContactPhone: s.originContactPhone,
    podUrl: s.podUrl,
    podSignedBy: s.podSignedBy,
    shipmentStatus: s.status,
    publicTrackingToken: s.publicTrackingToken ?? null,
  };
}

interface CreateRunPayload {
  name: string;
  scheduledDate: string;
  shift?: Shift;
  startTime?: string;
  driverId?: string;
  truckId?: string;
  shipmentIds?: string[];
}

interface UpdateRunPayload {
  name?: string;
  scheduledDate?: string;
  shift?: Shift;
  startTime?: string;
}

interface StopDonePayload {
  notes?: string;
  signedBy?: string;
  podUrl?: string;
}

interface StopIncidentPayload {
  reason: string;
  photoUrl?: string;
}

export const DeliveryRunsService = {
  async create(payload: CreateRunPayload): Promise<DeliveryRun> {
    const { data } = await apiClient.post<DeliveryRun>('/delivery-runs', payload);
    return data;
  },

  async getMyRuns(params?: { status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<DeliveryRun>> {
    const { data } = await apiClient.get<PaginatedResponse<DeliveryRun>>('/delivery-runs', {
      params,
    });
    return data;
  },

  async getActiveRun(): Promise<DeliveryRun | null> {
    const { data } = await apiClient.get<PaginatedResponse<DeliveryRun>>('/delivery-runs', {
      params: { status: 'in_progress', limit: 1 },
    });
    return data.data[0] ?? null;
  },

  async getRunById(id: string): Promise<DeliveryRun> {
    const { data } = await apiClient.get<any>(`/delivery-runs/${id}`);
    if (Array.isArray(data.shipments)) {
      data.stops = data.shipments.map(mapShipmentToStop);
    }
    return data as DeliveryRun;
  },

  async startRun(id: string): Promise<DeliveryRun> {
    const { data } = await apiClient.post<DeliveryRun>(`/delivery-runs/${id}/start`);
    return data;
  },

  async completeRun(id: string): Promise<DeliveryRun> {
    const { data } = await apiClient.post<DeliveryRun>(`/delivery-runs/${id}/complete`);
    return data;
  },

  async startTransit(runId: string, stopId: string): Promise<RunStop> {
    const { data } = await apiClient.post(`/delivery-runs/${runId}/stops/${stopId}/start-transit`);
    return mapShipmentToStop(data);
  },

  async arriveAtStop(runId: string, stopId: string): Promise<RunStop> {
    const { data } = await apiClient.post(`/delivery-runs/${runId}/stops/${stopId}/arrive`);
    return mapShipmentToStop(data);
  },

  async markStopDone(
    runId: string,
    stopId: string,
    payload: StopDonePayload
  ): Promise<RunStop> {
    const { data } = await apiClient.post<{ run: any; shipment: any }>(
      `/delivery-runs/${runId}/stops/${stopId}/done`,
      payload
    );
    return mapShipmentToStop(data.shipment ?? data);
  },

  async reportStopIncident(
    runId: string,
    stopId: string,
    payload: StopIncidentPayload
  ): Promise<RunStop> {
    const { data } = await apiClient.post<{ run: any; shipment: any }>(
      `/delivery-runs/${runId}/stops/${stopId}/incident`,
      payload
    );
    return mapShipmentToStop(data.shipment ?? data);
  },

  async getRunEtas(id: string): Promise<RunEtas> {
    const { data } = await apiClient.get<RunEtas>(`/delivery-runs/${id}/etas`);
    return data;
  },

  async optimizeRun(id: string): Promise<DeliveryRun> {
    await apiClient.post(`/delivery-runs/${id}/optimize`);
    return this.getRunById(id);
  },

  async update(id: string, payload: UpdateRunPayload): Promise<DeliveryRun> {
    const { data } = await apiClient.patch<DeliveryRun>(`/delivery-runs/${id}`, payload);
    return data;
  },

  async cancel(id: string, reason: string): Promise<DeliveryRun> {
    const { data } = await apiClient.post<DeliveryRun>(`/delivery-runs/${id}/cancel`, { reason });
    return data;
  },

  async addShipments(id: string, shipmentIds: string[]): Promise<DeliveryRun> {
    const { data } = await apiClient.post<any>(`/delivery-runs/${id}/add-shipments`, { shipmentIds });
    if (Array.isArray(data.shipments)) {
      data.stops = data.shipments.map(mapShipmentToStop);
    }
    return data as DeliveryRun;
  },

  async removeShipments(id: string, shipmentIds: string[]): Promise<DeliveryRun> {
    const { data } = await apiClient.post<any>(`/delivery-runs/${id}/remove-shipments`, { shipmentIds });
    if (Array.isArray(data.shipments)) {
      data.stops = data.shipments.map(mapShipmentToStop);
    }
    return data as DeliveryRun;
  },
};
