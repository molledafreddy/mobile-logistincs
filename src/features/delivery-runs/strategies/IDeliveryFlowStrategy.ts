import type { DeliveryRun, RunStop } from '../../../types';

/**
 * Contrato que define cómo se comporta un flujo de entrega.
 * Freight y Passenger tienen implementaciones distintas.
 */
export interface IDeliveryFlowStrategy {
  /** Ruta Expo Router a la que navegar al tocar una parada/pasajero */
  getStopRoute(runId: string, stopId: string): string;

  /** Ruta Expo Router al detalle completo del run */
  getRunRoute(runId: string): string;

  /** Texto del botón principal de acción en la tarjeta de parada */
  getStopActionLabel(run: DeliveryRun, stop: RunStop): string;

  /** ¿Se debe verificar compliance antes de iniciar el run? */
  requiresComplianceCheck(): boolean;

  /** Icono del tipo de operación */
  getRunTypeIcon(): string;

  /** Etiqueta del tipo de run para mostrar en UI */
  getRunTypeLabel(): string;
}
