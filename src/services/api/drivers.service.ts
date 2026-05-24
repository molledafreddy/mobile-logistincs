import { apiClient } from './client';
import type { Driver, PaginatedResponse } from '../../types';

interface CreateDriverPayload {
  userId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  licenseNumber: string;
  licenseClass?: string;
  licenseState?: string;
  licenseExpiresAt?: string;
}

interface QueryDriversParams {
  search?: string;
  status?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface DriverStats {
  driverId: string;
  driverName: string;
  totalTrips: number;
  ratingAvg: number;
  status: string;
}

export const DriversService = {
  async create(payload: CreateDriverPayload): Promise<Driver> {
    const { data } = await apiClient.post<Driver>('/drivers', payload);
    return data;
  },

  async getAll(params?: QueryDriversParams): Promise<PaginatedResponse<Driver>> {
    const { data } = await apiClient.get<PaginatedResponse<Driver>>('/drivers', { params });
    return data;
  },

  async getById(id: string): Promise<Driver> {
    const { data } = await apiClient.get<Driver>(`/drivers/${id}`);
    return data;
  },

  async getStats(id: string): Promise<DriverStats> {
    const { data } = await apiClient.get<DriverStats>(`/drivers/${id}/stats`);
    return data;
  },

  async updateStatus(id: string, status: string): Promise<Driver> {
    const { data } = await apiClient.patch<Driver>(`/drivers/${id}/status`, { status });
    return data;
  },
};
