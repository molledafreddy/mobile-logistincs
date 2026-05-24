import { apiClient } from './client';
import type { BillingRenewal, RetryRenewalResult, CheckoutResult } from '../../types';

export interface CreateCheckoutPayload {
  subscriptionId: string;
  amount: number;
  currency?: string;
  itemTitle: string;
  payerEmail?: string;
}

export const BillingService = {
  async getMyRenewal(): Promise<BillingRenewal> {
    const { data } = await apiClient.get<BillingRenewal>('/billing/me/renewal');
    return data;
  },

  async retry(): Promise<RetryRenewalResult> {
    const { data } = await apiClient.post<RetryRenewalResult>('/billing/me/retry');
    return data;
  },

  async createCheckout(payload: CreateCheckoutPayload): Promise<CheckoutResult> {
    const { data } = await apiClient.post<CheckoutResult>('/payments/checkout', payload);
    return data;
  },
};
