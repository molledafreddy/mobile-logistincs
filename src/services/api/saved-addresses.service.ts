import { apiClient } from './client';
import type { SavedAddress, SavedAddressKind, PaginatedResponse } from '../../types';

interface QueryParams {
  q?: string;
  kind?: SavedAddressKind;
  page?: number;
  limit?: number;
}

export interface CreateSavedAddressPayload {
  label: string;
  kind?: SavedAddressKind;
  formatted: string;
  lat: number;
  lng: number;
  notes?: string;
  placeId?: string;
  locality?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

export type UpdateSavedAddressPayload = Partial<CreateSavedAddressPayload>;

export const SavedAddressesService = {
  async getAll(params?: QueryParams): Promise<PaginatedResponse<SavedAddress>> {
    const { data } = await apiClient.get<PaginatedResponse<SavedAddress>>('/saved-addresses', { params });
    return data;
  },

  async getById(id: string): Promise<SavedAddress> {
    const { data } = await apiClient.get<SavedAddress>(`/saved-addresses/${id}`);
    return data;
  },

  async create(payload: CreateSavedAddressPayload): Promise<SavedAddress> {
    const { data } = await apiClient.post<SavedAddress>('/saved-addresses', payload);
    return data;
  },

  async update(id: string, payload: UpdateSavedAddressPayload): Promise<SavedAddress> {
    const { data } = await apiClient.patch<SavedAddress>(`/saved-addresses/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/saved-addresses/${id}`);
  },
};
