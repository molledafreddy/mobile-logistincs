import type { DeliveryRun, RunStop } from '../../../types';
import type { IDeliveryFlowStrategy } from './IDeliveryFlowStrategy';

export class FreightDeliveryStrategy implements IDeliveryFlowStrategy {
  getStopRoute(runId: string, stopId: string): string {
    return `/(app)/delivery/${runId}/stop/${stopId}`;
  }

  getRunRoute(runId: string): string {
    return `/(app)/delivery/${runId}`;
  }

  getStopActionLabel(_run: DeliveryRun, stop: RunStop): string {
    if (stop.status === 'pending')    return 'Iniciar entrega →';
    if (stop.status === 'in_transit') return 'Continuar entrega →';
    if (stop.status === 'arrived')    return 'Registrar entrega →';
    return '';
  }

  requiresComplianceCheck(): boolean {
    return false;
  }

  getRunTypeIcon(): string {
    return '📦';
  }

  getRunTypeLabel(): string {
    return 'Carga';
  }
}
