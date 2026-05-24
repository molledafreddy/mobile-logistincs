import { apiClient } from './client';
import type { Plan } from '../../types';

export const PlansService = {
  async getCatalog(): Promise<Plan[]> {
    const { data } = await apiClient.get<Plan[]>('/plans/catalog');
    return data;
  },

  async getMyLimits(): Promise<Record<string, Record<string, number>>> {
    const { data } = await apiClient.get<Record<string, Record<string, number>>>('/plans/me/limits');
    return data;
  },

  async getMyPermissions(): Promise<string[]> {
    const { data } = await apiClient.get<string[]>('/plans/me/permissions');
    return data;
  },
};
