import { ScrollView, View, Text, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShipmentsService } from '../../../src/services/api/shipments.service';
import type { ShipmentStatus, ShipmentTimelineEvent } from '../../../src/types';

const STATUS_CONFIG: Record<
  ShipmentStatus,
  { label: string; icon: string; bg: string; text: string }
> = {
  draft:               { label: 'Borrador',      icon: '📝', bg: 'bg-gray-100',    text: 'text-gray-600' },
  pending_acceptance:  { label: 'Por aceptar',   icon: '⏳', bg: 'bg-amber-50',   text: 'text-amber-700' },
  quoted:              { label: 'Cotizado',       icon: '💬', bg: 'bg-blue-50',    text: 'text-blue-600' },
  confirmed:           { label: 'Confirmado',     icon: '✅', bg: 'bg-primary-50', text: 'text-primary-700' },
  assigned:            { label: 'Asignado',       icon: '🚛', bg: 'bg-primary-50', text: 'text-primary-600' },
  picked_up:           { label: 'Recogido',       icon: '📤', bg: 'bg-blue-50',    text: 'text-blue-700' },
  in_transit:          { label: 'En tránsito',    icon: '🚚', bg: 'bg-blue-50',    text: 'text-blue-700' },
  at_stop:             { label: 'En parada',      icon: '📍', bg: 'bg-amber-50',   text: 'text-amber-700' },
  delivered:           { label: 'Entregado',      icon: '📦', bg: 'bg-primary-50', text: 'text-primary-700' },
  pod_uploaded:        { label: 'Comprobante',    icon: '📸', bg: 'bg-primary-50', text: 'text-primary-600' },
  completed:           { label: 'Completado',     icon: '🏁', bg: 'bg-primary-50', text: 'text-primary-700' },
  incident:            { label: 'Incidente',      icon: '⚠️', bg: 'bg-red-50',     text: 'text-red-700' },
  cancelled:           { label: 'Cancelado',      icon: '🚫', bg: 'bg-gray-100',   text: 'text-gray-500' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Baja',  color: 'text-text-muted' },
  normal: { label: 'Normal', color: 'text-text-secondary' },
  high:   { label: 'Alta',  color: 'text-amber-600' },
  urgent: { label: 'Urgente', color: 'text-red-600' },
};

const TIMELINE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  created:     { label: 'Envío creado',    icon: '📝', color: 'text-text-secondary' },
  proposed:    { label: 'Propuesto',       icon: '📤', color: 'text-blue-600' },
  accepted:    { label: 'Aceptado',        icon: '✅', color: 'text-primary-600' },
  rejected:    { label: 'Rechazado',       icon: '❌', color: 'text-red-600' },
  picked_up:   { label: 'Recogido',        icon: '🚚', color: 'text-blue-600' },
  delivered:   { label: 'Entregado',       icon: '📦', color: 'text-primary-600' },
  pod_uploaded:{ label: 'Comprobante',     icon: '📸', color: 'text-primary-600' },
  cancelled:   { label: 'Cancelado',       icon: '🚫', color: 'text-red-600' },
};

function TimelineEvent({
  item,
  isLast,
}: {
  item: ShipmentTimelineEvent;
  isLast: boolean;
}) {
  const cfg = TIMELINE_CONFIG[item.event] ?? { label: item.event, icon: '•', color: 'text-text-muted' };
  return (
    <View className="flex-row gap-x-3">
      <View className="items-center">
        <View className="w-8 h-8 rounded-full bg-surface-secondary border border-border items-center justify-center">
          <Text className="text-sm">{cfg.icon}</Text>
        </View>
        {!isLast && <View className="w-0.5 flex-1 bg-border mt-1 mb-1" />}
      </View>
      <View className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
        <Text className={`text-sm font-semibold ${cfg.color}`} style={{ fontFamily: 'Inter_600SemiBold' }}>
          {cfg.label}
        </Text>
        <Text className="text-text-muted text-xs mt-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
          {new Date(item.at).toLocaleDateString('es', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </Text>
        {item.reason && (
          <Text className="text-text-secondary text-xs mt-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
            {item.reason}
          </Text>
        )}
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-1">
      <Text className="text-xs text-text-muted mb-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
        {label}
      </Text>
      <Text className="text-text-primary text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
        {value}
      </Text>
    </View>
  );
}

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: shipment, isLoading } = useQuery({
    queryKey: ['shipments', id],
    queryFn: () => ShipmentsService.getById(id),
  });

  const { data: timeline } = useQuery({
    queryKey: ['shipments', id, 'timeline'],
    queryFn: () => ShipmentsService.getTimeline(id),
    enabled: !!id,
    staleTime: 60_000,
  });

  const status = shipment ? STATUS_CONFIG[shipment.status] : null;
  const priority = shipment ? (PRIORITY_CONFIG[shipment.priority] ?? PRIORITY_CONFIG.normal) : null;

  const handleCall = () => {
    if (shipment?.destinationContactPhone) {
      Linking.openURL(`tel:${shipment.destinationContactPhone}`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 bg-white rounded-full items-center justify-center border border-border mr-3"
        >
          <Text className="text-text-primary">←</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            className="text-text-primary text-lg font-bold"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            Detalle del envío
          </Text>
          {shipment && (
            <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              #{shipment.id.slice(-8).toUpperCase()}
            </Text>
          )}
        </View>
        {status && (
          <View className={`flex-row items-center px-3 py-1.5 rounded-full ${status.bg}`}>
            <Text className="text-sm mr-1">{status.icon}</Text>
            <Text className={`text-xs font-medium ${status.text}`} style={{ fontFamily: 'Inter_600SemiBold' }}>
              {status.label}
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
            Cargando envío…
          </Text>
        </View>
      ) : !shipment ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">📦</Text>
          <Text
            className="text-text-primary font-semibold text-center mb-1"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Envío no encontrado
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-10"
          showsVerticalScrollIndicator={false}
        >
          {/* Priority chip */}
          {priority && shipment.priority !== 'normal' && (
            <View className="flex-row items-center mb-4 mt-1">
              <View className="bg-white border border-border rounded-full px-3 py-1">
                <Text
                  className={`text-xs font-medium ${priority.color}`}
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  Prioridad {priority.label}
                </Text>
              </View>
            </View>
          )}

          {/* Description */}
          <View className="bg-white rounded-2xl p-4 border border-border mb-3">
            <Text
              className="text-xs text-text-muted mb-1"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Descripción del envío
            </Text>
            <Text
              className="text-text-primary font-medium"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              {shipment.description}
            </Text>
          </View>

          {/* Route */}
          <View className="bg-white rounded-2xl p-4 border border-border mb-3">
            <Text
              className="text-xs text-text-muted font-medium mb-3"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              RUTA
            </Text>

            <View className="flex-row gap-x-3 mb-3">
              <View className="items-center pt-0.5">
                <View className="w-7 h-7 rounded-full bg-primary-100 items-center justify-center">
                  <Text className="text-xs">📤</Text>
                </View>
                <View className="w-0.5 flex-1 bg-border my-1" />
                <View className="w-7 h-7 rounded-full bg-primary-500 items-center justify-center">
                  <Text className="text-xs">📥</Text>
                </View>
              </View>

              <View className="flex-1 gap-y-3">
                <View>
                  <Text
                    className="text-xs text-text-muted mb-0.5"
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    Origen
                  </Text>
                  <Text
                    className="text-text-primary text-sm"
                    style={{ fontFamily: 'Inter_500Medium' }}
                  >
                    {shipment.originAddress}
                  </Text>
                </View>

                <View>
                  <Text
                    className="text-xs text-text-muted mb-0.5"
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    Destino
                  </Text>
                  <Text
                    className="text-text-primary text-sm"
                    style={{ fontFamily: 'Inter_500Medium' }}
                  >
                    {shipment.destinationAddress}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contact */}
          {(shipment.destinationContactName || shipment.destinationContactPhone) && (
            <View className="bg-white rounded-2xl p-4 border border-border mb-3">
              <Text
                className="text-xs text-text-muted font-medium mb-3"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                CONTACTO EN DESTINO
              </Text>

              {shipment.destinationContactName && (
                <InfoRow label="Nombre" value={shipment.destinationContactName} />
              )}

              {shipment.destinationContactPhone && (
                <TouchableOpacity
                  onPress={handleCall}
                  activeOpacity={0.7}
                  className="flex-row items-center mt-2 bg-primary-50 rounded-xl px-3 py-2.5"
                >
                  <Text className="text-lg mr-2">📞</Text>
                  <Text
                    className="text-primary-600 font-medium flex-1"
                    style={{ fontFamily: 'Inter_500Medium' }}
                  >
                    {shipment.destinationContactPhone}
                  </Text>
                  <Text
                    className="text-primary-400 text-xs"
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    Llamar
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Notes */}
          {shipment.notes && (
            <View className="bg-amber-50 rounded-2xl p-4 border border-amber-100 mb-3">
              <Text
                className="text-xs text-amber-700 font-medium mb-1"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                📝 Notas
              </Text>
              <Text
                className="text-amber-800 text-sm"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                {shipment.notes}
              </Text>
            </View>
          )}

          {/* Meta */}
          <View className="bg-white rounded-2xl p-4 border border-border mb-3">
            <Text
              className="text-xs text-text-muted font-medium mb-3"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              INFORMACIÓN
            </Text>
            <InfoRow
              label="Creado"
              value={new Date(shipment.createdAt).toLocaleDateString('es', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
            <InfoRow label="ID del envío" value={shipment.id.slice(-8).toUpperCase()} />
          </View>

          {/* Timeline */}
          {timeline && timeline.events.length > 0 && (
            <View className="bg-white rounded-2xl p-4 border border-border">
              <Text
                className="text-xs text-text-muted font-medium mb-4"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                HISTORIAL
              </Text>
              {timeline.events.map((event, index) => (
                <TimelineEvent
                  key={`${event.event}-${event.at}`}
                  item={event}
                  isLast={index === timeline.events.length - 1}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
