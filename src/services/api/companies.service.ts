import { apiClient } from './client';
import type { Company, PaginatedResponse } from '../../types';

interface QueryCompaniesParams {
  search?: string;
  page?: number;
  limit?: number;
}

export const CompaniesService = {
  async getById(id: string): Promise<Company> {
    const { data } = await apiClient.get<Company>(`/companies/${id}`);
    return data;
  },

  async getAll(params?: QueryCompaniesParams): Promise<PaginatedResponse<Company>> {
    const { data } = await apiClient.get<PaginatedResponse<Company>>('/companies', { params });
    return data;
  },
};
