import { DeliveryFlowFactory } from './DeliveryFlowFactory';
import { FreightDeliveryStrategy } from './FreightDeliveryStrategy';
import { PassengerRunStrategy } from './PassengerRunStrategy';

describe('DeliveryFlowFactory', () => {
  it('returns FreightDeliveryStrategy for "freight"', () => {
    expect(DeliveryFlowFactory.create('freight')).toBeInstanceOf(FreightDeliveryStrategy);
  });

  it('returns PassengerRunStrategy for "passenger"', () => {
    expect(DeliveryFlowFactory.create('passenger')).toBeInstanceOf(PassengerRunStrategy);
  });

  it('returns PassengerRunStrategy for "mixed" (strictest rules)', () => {
    expect(DeliveryFlowFactory.create('mixed')).toBeInstanceOf(PassengerRunStrategy);
  });

  it('defaults to FreightDeliveryStrategy for unknown service types', () => {
    // @ts-expect-error testing unknown value
    expect(DeliveryFlowFactory.create('unknown')).toBeInstanceOf(FreightDeliveryStrategy);
  });

  it('freight strategy does not require compliance check', () => {
    const strategy = DeliveryFlowFactory.create('freight');
    expect(strategy.requiresComplianceCheck()).toBe(false);
  });

  it('passenger strategy requires compliance check', () => {
    const strategy = DeliveryFlowFactory.create('passenger');
    expect(strategy.requiresComplianceCheck()).toBe(true);
  });

  it('freight strategy builds correct stop route', () => {
    const strategy = DeliveryFlowFactory.create('freight');
    expect(strategy.getStopRoute('run-1', 'stop-2')).toBe('/(app)/delivery/run-1/stop/stop-2');
  });

  it('freight getRunTypeIcon returns package emoji', () => {
    const strategy = DeliveryFlowFactory.create('freight');
    expect(strategy.getRunTypeIcon()).toBe('📦');
  });
});
