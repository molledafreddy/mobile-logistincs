import { apiClient } from './client';
import type { Shipment, ShipmentTimeline, PaginatedResponse } from '../../types';

export interface CreateShipmentPayload {
  // Addresses
  originAddress: string;
  originLat?: number;
  originLng?: number;
  destinationAddress: string;
  destinationLat?: number;
  destinationLng?: number;
  // Cargo
  description: string;
  referenceNumber?: string;
  priority?: 'normal' | 'high' | 'urgent';
  cargoType?: 'general' | 'fragile' | 'refrigerated' | 'hazmat' | 'valuable';
  weightKg?: string;
  volumeM3?: string;
  pieces?: number;
  // Contacts
  originContactName?: string;
  originContactPhone?: string;
  destinationContactName?: string;
  destinationContactPhone?: string;
  // Scheduling
  pickupAt?: string;
  deliveryAt?: string;
  // Relations
  driverId?: string;
  truckId?: string;
  notes?: string;
}

interface QueryShipmentsParams {
  status?: string;
  driverId?: string;
  page?: number;
  limit?: number;
}

export const ShipmentsService = {
  async create(payload: CreateShipmentPayload): Promise<Shipment> {
    const { data } = await apiClient.post<Shipment>('/shipments', payload);
    return data;
  },

  async getAll(params?: QueryShipmentsParams): Promise<PaginatedResponse<Shipment>> {
    const { data } = await apiClient.get<PaginatedResponse<Shipment>>('/shipments', { params });
    return data;
  },

  async getById(id: string): Promise<Shipment> {
    const { data } = await apiClient.get<Shipment>(`/shipments/${id}`);
    return data;
  },

  async getTimeline(id: string): Promise<ShipmentTimeline> {
    const { data } = await apiClient.get<ShipmentTimeline>(`/shipments/${id}/timeline`);
    return data;
  },

  async update(id: string, payload: Partial<CreateShipmentPayload>): Promise<Shipment> {
    const { data } = await apiClient.patch<Shipment>(`/shipments/${id}`, payload);
    return data;
  },
};
