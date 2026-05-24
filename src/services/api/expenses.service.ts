import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { apiClient } from './client';
import type { Expense, PaginatedResponse } from '../../types';

interface CreateExpensePayload {
  category: string;
  amount: string;
  currency?: string;
  description: string;
  expenseDate: string;
  receiptUrl?: string;
}

export const ExpensesService = {
  async getMyExpenses(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Expense>> {
    const { data } = await apiClient.get<PaginatedResponse<Expense>>('/expenses', {
      params: { limit: 50, ...params },
    });
    data.data = data.data.map((e) => ({ ...e, amount: Number(e.amount) }));
    return data;
  },

  async createExpense(payload: CreateExpensePayload): Promise<Expense> {
    const { data } = await apiClient.post<Expense>('/expenses', payload);
    return data;
  },

  async getPendingExpenses(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Expense>> {
    const { data } = await apiClient.get<PaginatedResponse<Expense>>('/expenses', {
      params: { status: 'pending', limit: 50, ...params },
    });
    data.data = data.data.map((e) => ({ ...e, amount: Number(e.amount) }));
    return data;
  },

  async getExpenseById(id: string): Promise<Expense> {
    const { data } = await apiClient.get<Expense>(`/expenses/${id}`);
    return { ...data, amount: Number(data.amount) };
  },

  async approveExpense(id: string): Promise<Expense> {
    const { data } = await apiClient.patch<Expense>(`/expenses/${id}/approve`);
    return data;
  },

  async rejectExpense(id: string, reason?: string): Promise<Expense> {
    const { data } = await apiClient.patch<Expense>(`/expenses/${id}/reject`, reason ? { reason } : {});
    return data;
  },

  async uploadReceipt(uri: string): Promise<{ url: string; key: string }> {
    const filename = `receipt_${Date.now()}.jpg`;

    // Step 1: get a presigned S3 upload URL from the API
    const { data: { url: uploadUrl, key } } = await apiClient.post<{ url: string; key: string }>(
      '/files/upload-url',
      { folder: 'receipts', filename, contentType: 'image/jpeg' }
    );

    // Step 2: PUT the file directly to S3 using native file I/O.
    // fetch('file://...') corrupts Android's network stack — FileSystem.uploadAsync uses
    // native APIs to read the local file and avoids that issue.
    await uploadAsync(uploadUrl, uri, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': 'image/jpeg' },
    });

    // Step 3: get a presigned download URL to use as the receipt URL
    const { data: downloadUrl } = await apiClient.get<string>('/files/download-url', {
      params: { key },
    });

    return { url: downloadUrl, key };
  },
};
