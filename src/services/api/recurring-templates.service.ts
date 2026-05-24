import { apiClient } from './client';
import type {
  RecurringTemplate,
  ShipmentTemplateSnapshot,
  GenerationResult,
  PaginatedResponse,
  RecurrencePattern,
} from '../../types';

export interface CreateRecurringTemplatePayload {
  name: string;
  pattern: RecurrencePattern;
  daysOfWeek?: number[];
  time: string;
  startDate: string;
  endDate?: string;
  driverId?: string;
  truckId?: string;
  shipmentTemplates: ShipmentTemplateSnapshot[];
}

export interface QueryRecurringTemplateParams {
  active?: boolean;
  pattern?: RecurrencePattern;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name' | 'startDate' | 'lastGeneratedAt';
  sortOrder?: 'ASC' | 'DESC';
}

export const RecurringTemplatesService = {
  async getAll(params?: QueryRecurringTemplateParams): Promise<PaginatedResponse<RecurringTemplate>> {
    const { data } = await apiClient.get<PaginatedResponse<RecurringTemplate>>(
      '/recurring-templates',
      { params },
    );
    return data;
  },

  async getById(id: string): Promise<RecurringTemplate> {
    const { data } = await apiClient.get<RecurringTemplate>(`/recurring-templates/${id}`);
    return data;
  },

  async create(payload: CreateRecurringTemplatePayload): Promise<RecurringTemplate> {
    const { data } = await apiClient.post<RecurringTemplate>('/recurring-templates', payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<CreateRecurringTemplatePayload>,
  ): Promise<RecurringTemplate> {
    const { data } = await apiClient.patch<RecurringTemplate>(
      `/recurring-templates/${id}`,
      payload,
    );
    return data;
  },

  async generate(id: string, date: string): Promise<GenerationResult> {
    const { data } = await apiClient.post<GenerationResult>(
      `/recurring-templates/${id}/generate`,
      { date },
    );
    return data;
  },

  async pause(id: string): Promise<RecurringTemplate> {
    const { data } = await apiClient.post<RecurringTemplate>(
      `/recurring-templates/${id}/pause`,
    );
    return data;
  },

  async resume(id: string): Promise<RecurringTemplate> {
    const { data } = await apiClient.post<RecurringTemplate>(
      `/recurring-templates/${id}/resume`,
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/recurring-templates/${id}`);
  },
};
