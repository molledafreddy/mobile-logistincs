import { apiClient } from './client';
import type { Truck, TruckType, TruckStatus, PaginatedResponse } from '../../types';

interface CreateTruckPayload {
  plate: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  type?: TruckType;
  capacityKg?: string;
  status?: TruckStatus;
  currentDriverId?: string;
  insuranceExpiresAt?: string;
  registrationExpiresAt?: string;
  odometerKm?: number;
  notes?: string;
}

interface QueryTrucksParams {
  search?: string;
  status?: TruckStatus;
  type?: TruckType;
  driverId?: string;
  page?: number;
  limit?: number;
}

export const TrucksService = {
  async create(payload: CreateTruckPayload): Promise<Truck> {
    const { data } = await apiClient.post<Truck>('/trucks', payload);
    return data;
  },

  async getAll(params?: QueryTrucksParams): Promise<PaginatedResponse<Truck>> {
    const { data } = await apiClient.get<PaginatedResponse<Truck>>('/trucks', { params });
    return data;
  },

  async getById(id: string): Promise<Truck> {
    const { data } = await apiClient.get<Truck>(`/trucks/${id}`);
    return data;
  },

  async assignDriver(truckId: string, driverId: string): Promise<Truck> {
    const { data } = await apiClient.patch<Truck>(`/trucks/${truckId}/assign-driver`, { driverId });
    return data;
  },

  async unassignDriver(truckId: string): Promise<Truck> {
    const { data } = await apiClient.patch<Truck>(`/trucks/${truckId}/unassign-driver`);
    return data;
  },

  async updateStatus(truckId: string, status: TruckStatus): Promise<Truck> {
    const { data } = await apiClient.patch<Truck>(`/trucks/${truckId}/status`, { status });
    return data;
  },

  async update(truckId: string, payload: Partial<CreateTruckPayload>): Promise<Truck> {
    const { data } = await apiClient.patch<Truck>(`/trucks/${truckId}`, payload);
    return data;
  },
};
