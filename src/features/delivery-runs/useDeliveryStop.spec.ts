import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { DeliveryRunsService } from '../../services/api/delivery-runs.service';
import { ExpensesService } from '../../services/api/expenses.service';
import { OfflineQueue } from '../../services/offline/offline-queue.service';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

jest.mock('../../services/api/delivery-runs.service', () => ({
  DeliveryRunsService: {
    markStopDone: jest.fn(),
    reportStopIncident: jest.fn(),
  },
}));

jest.mock('../../services/api/expenses.service', () => ({
  ExpensesService: { uploadReceipt: jest.fn(), createExpense: jest.fn() },
}));

jest.mock('../../services/offline/offline-queue.service', () => ({
  OfflineQueue: {
    enqueueStopStatus: jest.fn(),
    enqueueMessage: jest.fn(),
    enqueueExpense: jest.fn(),
    enqueueLocation: jest.fn(),
    pendingCount: jest.fn(() => 0),
    pendingMessages: jest.fn(() => []),
    flush: jest.fn(),
    startAutoSync: jest.fn(() => jest.fn()),
  },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    write: jest.fn(),
    delete: jest.fn(),
    uri: 'file://tmp/signature.png',
  })),
  Paths: { cache: '/cache' },
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

import { useDeliveryStop } from './useDeliveryStop';

const mockStop = {
  id: 'stop-1',
  sequence: 1,
  type: 'dropoff' as const,
  status: 'pending' as const,
  address: '123 Main St',
  lat: 0,
  lng: 0,
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['delivery-runs', 'run-1'], {
    id: 'run-1',
    stops: [mockStop],
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDeliveryStop', () => {
  describe('arrive()', () => {
    it('updates cache optimistically without any API call or queue enqueue', async () => {
      const { result } = renderHook(() => useDeliveryStop('run-1', 'stop-1'), {
        wrapper: makeWrapper(),
      });

      result.current.arrive(undefined);

      await waitFor(() => expect(result.current.isArriving).toBe(false));

      expect(DeliveryRunsService.markStopDone).not.toHaveBeenCalled();
      expect(OfflineQueue.enqueueStopStatus).not.toHaveBeenCalled();
    });
  });

  describe('deliver()', () => {
    it('uploads photos and calls markStopDone when online', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
      (ExpensesService.uploadReceipt as jest.Mock).mockResolvedValue({ url: 'https://cdn/photo.jpg' });
      (DeliveryRunsService.markStopDone as jest.Mock).mockResolvedValue({ ...mockStop, status: 'delivered' });

      const { result } = renderHook(() => useDeliveryStop('run-1', 'stop-1'), {
        wrapper: makeWrapper(),
      });

      result.current.deliver({
        photoUris: ['file://photo.jpg'],
        receiverName: 'Ana Lopez',
        notes: 'Left at door',
      });

      await waitFor(() => {
        expect(ExpensesService.uploadReceipt).toHaveBeenCalledWith('file://photo.jpg');
        expect(DeliveryRunsService.markStopDone).toHaveBeenCalledWith(
          'run-1',
          'stop-1',
          expect.objectContaining({
            signedBy: 'Ana Lopez',
            podUrl: 'https://cdn/photo.jpg',
            notes: 'Left at door',
          })
        );
      });
    });

    it('enqueues to OfflineQueue without uploading photos when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

      const { result } = renderHook(() => useDeliveryStop('run-1', 'stop-1'), {
        wrapper: makeWrapper(),
      });

      result.current.deliver({
        photoUris: ['file://photo.jpg'],
        receiverName: 'Ana Lopez',
      });

      await waitFor(() => {
        expect(OfflineQueue.enqueueStopStatus).toHaveBeenCalledWith(
          expect.objectContaining({ runId: 'run-1', stopId: 'stop-1', status: 'delivered' })
        );
        expect(ExpensesService.uploadReceipt).not.toHaveBeenCalled();
        expect(DeliveryRunsService.markStopDone).not.toHaveBeenCalled();
      });
    });

    it('calls markStopDone with podUrl undefined when no photos provided', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
      (DeliveryRunsService.markStopDone as jest.Mock).mockResolvedValue({ ...mockStop, status: 'delivered' });

      const { result } = renderHook(() => useDeliveryStop('run-1', 'stop-1'), {
        wrapper: makeWrapper(),
      });

      result.current.deliver({ photoUris: [] });

      await waitFor(() => {
        expect(ExpensesService.uploadReceipt).not.toHaveBeenCalled();
        expect(DeliveryRunsService.markStopDone).toHaveBeenCalledWith(
          'run-1',
          'stop-1',
          expect.objectContaining({ podUrl: undefined })
        );
      });
    });
  });

  describe('fail()', () => {
    it('uploads photo and calls reportStopIncident when online', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
      (ExpensesService.uploadReceipt as jest.Mock).mockResolvedValue({ url: 'https://cdn/incident.jpg' });
      (DeliveryRunsService.reportStopIncident as jest.Mock).mockResolvedValue({ ...mockStop, status: 'failed' });

      const { result } = renderHook(() => useDeliveryStop('run-1', 'stop-1'), {
        wrapper: makeWrapper(),
      });

      result.current.fail({ reason: 'Nobody home', photoUri: 'file://incident.jpg' });

      await waitFor(() => {
        expect(ExpensesService.uploadReceipt).toHaveBeenCalledWith('file://incident.jpg');
        expect(DeliveryRunsService.reportStopIncident).toHaveBeenCalledWith(
          'run-1',
          'stop-1',
          { reason: 'Nobody home', photoUrl: 'https://cdn/incident.jpg' }
        );
      });
    });

    it('calls reportStopIncident without photo when none provided', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
      (DeliveryRunsService.reportStopIncident as jest.Mock).mockResolvedValue({ ...mockStop, status: 'failed' });

      const { result } = renderHook(() => useDeliveryStop('run-1', 'stop-1'), {
        wrapper: makeWrapper(),
      });

      result.current.fail({ reason: 'Wrong address' });

      await waitFor(() => {
        expect(ExpensesService.uploadReceipt).not.toHaveBeenCalled();
        expect(DeliveryRunsService.reportStopIncident).toHaveBeenCalledWith(
          'run-1',
          'stop-1',
          { reason: 'Wrong address', photoUrl: undefined }
        );
      });
    });

    it('enqueues to OfflineQueue when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

      const { result } = renderHook(() => useDeliveryStop('run-1', 'stop-1'), {
        wrapper: makeWrapper(),
      });

      result.current.fail({ reason: 'No access' });

      await waitFor(() => {
        expect(OfflineQueue.enqueueStopStatus).toHaveBeenCalledWith(
          expect.objectContaining({ runId: 'run-1', stopId: 'stop-1', status: 'failed', reason: 'No access' })
        );
        expect(DeliveryRunsService.reportStopIncident).not.toHaveBeenCalled();
      });
    });
  });
});
