import type { DeliveryRun, RunStop } from '../../../types';
import type { IDeliveryFlowStrategy } from './IDeliveryFlowStrategy';

export class PassengerRunStrategy implements IDeliveryFlowStrategy {
  getStopRoute(runId: string, stopId: string): string {
    // Los runs de pasajeros usan una pantalla especializada de check-in
    return `/(app)/delivery/${runId}/passenger/${stopId}`;
  }

  getRunRoute(runId: string): string {
    return `/(app)/delivery/${runId}`;
  }

  getStopActionLabel(_run: DeliveryRun, stop: RunStop): string {
    if (stop.status === 'pending')    return 'Registrar pasajeros →';
    if (stop.status === 'in_transit') return 'Continuar traslado →';
    if (stop.status === 'arrived')    return 'Check-in/out →';
    return '';
  }

  requiresComplianceCheck(): boolean {
    // Pasajeros siempre requiere tier passenger_safe vigente
    return true;
  }

  getRunTypeIcon(): string {
    return '🚌';
  }

  getRunTypeLabel(): string {
    return 'Pasajeros';
  }
}
