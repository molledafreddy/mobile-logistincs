import { apiClient } from './client';
import type { Passenger, PassengerRun, RunEtas } from '../../types';

interface CheckInPayload {
  notes?: string;
}

export const PassengersService = {
  async getPassengerRun(runId: string): Promise<PassengerRun> {
    const { data } = await apiClient.get<PassengerRun>(`/delivery-runs/${runId}/passengers`);
    return data;
  },

  async checkInPassenger(runId: string, passengerId: string, payload?: CheckInPayload): Promise<Passenger> {
    const { data } = await apiClient.patch<Passenger>(
      `/delivery-runs/${runId}/passengers/${passengerId}/check-in`,
      payload ?? {}
    );
    return data;
  },

  async checkOutPassenger(runId: string, passengerId: string, payload?: CheckInPayload): Promise<Passenger> {
    const { data } = await apiClient.patch<Passenger>(
      `/delivery-runs/${runId}/passengers/${passengerId}/check-out`,
      payload ?? {}
    );
    return data;
  },

  async markAbsent(runId: string, passengerId: string): Promise<Passenger> {
    const { data } = await apiClient.patch<Passenger>(
      `/delivery-runs/${runId}/passengers/${passengerId}/absent`
    );
    return data;
  },

  async getRunEtas(runId: string): Promise<RunEtas> {
    const { data } = await apiClient.get<RunEtas>(`/delivery-runs/${runId}/etas`);
    return data;
  },
};
