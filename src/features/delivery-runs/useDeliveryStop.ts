import { useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { NetInfoService as NetInfo } from '../../services/netinfo';
import { DeliveryRunsService } from '../../services/api/delivery-runs.service';
import { ExpensesService } from '../../services/api/expenses.service';
import { OfflineQueue } from '../../services/offline/offline-queue.service';
import type { RunStop } from '../../types';

interface DeliverPayload {
  photoUris: string[];
  receiverName?: string;
  notes?: string;
  signatureBase64?: string | null;
}

interface FailPayload {
  reason: string;
  photoUri?: string;
}

async function tryUploadPhoto(uri: string): Promise<string | null> {
  try {
    const { url } = await ExpensesService.uploadReceipt(uri);
    return url;
  } catch {
    return null;
  }
}

async function tryUploadSignature(base64: string): Promise<string | null> {
  try {
    const tmpUri = `${cacheDirectory}sig_${Date.now()}.png`;
    await writeAsStringAsync(tmpUri, base64, { encoding: EncodingType.Base64 });
    const { url } = await ExpensesService.uploadReceipt(tmpUri);
    return url;
  } catch {
    return null;
  }
}

export function useDeliveryStop(runId: string, stopId: string) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['delivery-runs', runId] });
    queryClient.invalidateQueries({ queryKey: ['delivery-runs', 'active'] });
  };

  const arriveMutation = useMutation({
    mutationFn: () => DeliveryRunsService.arriveAtStop(runId, stopId),
    onSuccess: (updatedStop) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateStopInCache(updatedStop);
      invalidate();
    },
    onError: () => Alert.alert('Error', 'No se pudo confirmar la llegada.'),
  });

  const deliverMutation = useMutation({
    mutationFn: async ({ photoUris, receiverName, notes, signatureBase64 }: DeliverPayload) => {
      const net = await NetInfo.fetch();

      if (!net.isConnected) {
        OfflineQueue.enqueueStopStatus({
          runId,
          stopId,
          status: 'delivered',
          receiverName,
          notes,
        });
        return optimisticStopUpdate('delivered');
      }

      // Confirm delivery first — uploads are best-effort and run after success.
      const result = await DeliveryRunsService.markStopDone(runId, stopId, {
        signedBy: receiverName,
        notes,
      });

      // Fire-and-forget: upload evidence in the background without blocking.
      if (photoUris.length > 0 || signatureBase64) {
        Promise.all([
          photoUris.length > 0 ? tryUploadPhoto(photoUris[0]) : null,
          signatureBase64 ? tryUploadSignature(signatureBase64) : null,
        ]).catch(() => {});
      }

      return result;
    },
    onSuccess: (updatedStop) => {
      setIsUploading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateStopInCache(updatedStop);
      invalidate();
    },
    onError: (error) => {
      setIsUploading(false);
      console.error('[Deliver] error:', error);
      Alert.alert('Error', 'No se pudo registrar la entrega. Intenta de nuevo.');
    },
  });

  const failMutation = useMutation({
    mutationFn: async ({ reason, photoUri }: FailPayload) => {
      const net = await NetInfo.fetch();

      if (!net.isConnected) {
        OfflineQueue.enqueueStopStatus({ runId, stopId, status: 'failed', reason });
        return optimisticStopUpdate('failed');
      }

      const result = await DeliveryRunsService.reportStopIncident(runId, stopId, { reason });

      if (photoUri) {
        tryUploadPhoto(photoUri).catch(() => {});
      }

      return result;
    },
    onSuccess: (updatedStop) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      updateStopInCache(updatedStop);
      invalidate();
    },
    onError: () => Alert.alert('Error', 'No se pudo reportar el incidente. Intenta de nuevo.'),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function optimisticStopUpdate(status: RunStop['status']): RunStop {
    return {
      id: stopId,
      sequence: 0,
      type: 'dropoff',
      status,
      address: '',
      lat: 0,
      lng: 0,
      arrivedAt: status === 'arrived' ? new Date().toISOString() : undefined,
      deliveredAt: status === 'delivered' ? new Date().toISOString() : undefined,
    };
  }

  function updateStopInCache(updatedStop: RunStop) {
    queryClient.setQueryData(
      ['delivery-runs', runId],
      (prev: { stops: RunStop[] } | undefined) => {
        if (!prev) return prev;
        return {
          ...prev,
          stops: prev.stops.map((s) => (s.id === stopId ? { ...s, ...updatedStop } : s)),
        };
      }
    );
  }

  return {
    arrive: arriveMutation.mutate,
    deliver: deliverMutation.mutate,
    fail: failMutation.mutate,
    isArriving: arriveMutation.isPending,
    isDelivering: deliverMutation.isPending,
    isFailing: failMutation.isPending,
    isUploading,
  };
}
