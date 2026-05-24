import type { ServiceType } from '../../../types';
import type { IDeliveryFlowStrategy } from './IDeliveryFlowStrategy';
import { FreightDeliveryStrategy } from './FreightDeliveryStrategy';
import { PassengerRunStrategy } from './PassengerRunStrategy';

/**
 * Factory que devuelve la estrategia correcta según el tipo de servicio
 * de la empresa del conductor autenticado.
 *
 * Abierto a extensión (OCP): agregar 'mixed' u otros verticales
 * no modifica las estrategias existentes.
 */
export class DeliveryFlowFactory {
  private static readonly strategies: Record<string, IDeliveryFlowStrategy> = {
    freight: new FreightDeliveryStrategy(),
    passenger: new PassengerRunStrategy(),
    mixed: new PassengerRunStrategy(), // mixed siempre usa las reglas más estrictas
  };

  static create(serviceType: ServiceType): IDeliveryFlowStrategy {
    return this.strategies[serviceType] ?? this.strategies.freight;
  }
}
