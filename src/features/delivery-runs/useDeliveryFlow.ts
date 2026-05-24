import { useMemo } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { DeliveryFlowFactory } from './strategies/DeliveryFlowFactory';
import type { IDeliveryFlowStrategy } from './strategies/IDeliveryFlowStrategy';

/**
 * Hook que expone la estrategia de entrega activa para el conductor.
 * Los componentes no saben si están en modo freight o passenger —
 * solo llaman métodos del contrato IDeliveryFlowStrategy.
 */
export function useDeliveryFlow(): IDeliveryFlowStrategy {
  const serviceType = useAuthStore((s) => s.user?.serviceType ?? 'freight');

  return useMemo(
    () => DeliveryFlowFactory.create(serviceType),
    [serviceType]
  );
}
