import { apiClient } from './client';

export interface OverviewData {
  shipments: { total: number; active: number; completed: number };
  trucks: { total: number; available: number; inTransit: number; utilization: number };
  drivers: { total: number; onTrip: number };
  expenses: { pendingApproval: number };
}

export interface ExpenseByCategoryItem {
  category: string;
  total: number;
  count: number;
}

export interface DriverStats {
  driverId: string;
  driverName: string;
  totalTrips: number;
  ratingAvg: number;
  status: string;
}

interface DashboardQuery {
  from?: string;
  to?: string;
}

export const DashboardService = {
  async getOverview(query?: DashboardQuery): Promise<OverviewData> {
    const { data } = await apiClient.get<OverviewData>('/dashboard/overview', {
      params: query,
    });
    return data;
  },

  async getExpensesByCategory(query?: DashboardQuery): Promise<ExpenseByCategoryItem[]> {
    const { data } = await apiClient.get<ExpenseByCategoryItem[]>(
      '/dashboard/expenses/by-category',
      { params: query },
    );
    return data;
  },
};
