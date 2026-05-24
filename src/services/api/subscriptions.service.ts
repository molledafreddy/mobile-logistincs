import { apiClient } from './client';
import type { Subscription } from '../../types';

export const SubscriptionsService = {
  async getByCompany(companyId: string): Promise<Subscription[]> {
    const { data } = await apiClient.get<Subscription[]>(`/subscriptions/company/${companyId}`);
    return data;
  },

  async activatePlan(companyId: string, planId: string): Promise<Subscription> {
    const { data } = await apiClient.post<Subscription>('/subscriptions/free', { companyId, planId });
    return data;
  },

  async upgrade(subscriptionId: string, newPlanId: string): Promise<void> {
    await apiClient.patch(`/subscriptions/${subscriptionId}/upgrade`, { newPlanId });
  },

  async cancel(subscriptionId: string): Promise<Subscription> {
    const { data } = await apiClient.patch<Subscription>(`/subscriptions/${subscriptionId}/cancel`);
    return data;
  },
};
