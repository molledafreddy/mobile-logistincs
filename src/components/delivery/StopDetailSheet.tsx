import { useCallback } from 'react';
import { View, Text, Linking } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  TouchableOpacity,
} from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { StopStatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { RunStop } from '../../types';

const STOP_TYPE_ICON: Record<string, string> = {
  pickup: '📤',
  dropoff: '📥',
  waypoint: '📍',
};

const STOP_TYPE_LABEL: Record<string, string> = {
  pickup: 'Recogida',
  dropoff: 'Entrega',
  waypoint: 'Parada',
};

const CARGO_TYPE_LABEL: Record<string, string> = {
  general: 'General',
  fragile: 'Frágil',
  refrigerated: 'Refrigerado',
  hazmat: 'Mat. peligrosos',
  valuable: 'Valioso',
  passenger: 'Pasajero',
};

const PRIORITY_COLOR: Record<string, string> = {
  low: '#94a3b8',
  normal: '#64748b',
  high: '#f59e0b',
  urgent: '#ef4444',
};

interface StopDetailSheetProps {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  stop: RunStop | null;
  stopIndex: number;
  actionLabel?: string;
  onAction: () => void;
  onIncident?: () => void;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#94a3b8', letterSpacing: 0.8, marginBottom: 8 }}>
      {children.toUpperCase()}
    </Text>
  );
}

export function StopDetailSheet({
  sheetRef,
  stop,
  stopIndex,
  actionLabel,
  onAction,
  onIncident,
}: StopDetailSheetProps) {
  const router = useRouter();
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
    ),
    []
  );

  if (!stop) return null;

  const isActionable = stop.status === 'pending' || stop.status === 'in_transit' || stop.status === 'arrived';
  const isCompleted = stop.status === 'delivered';
  const isFailed = stop.status === 'failed';
  const isPassenger = stop.cargoType === 'passenger';

  const handleCall = (phone: string) => Linking.openURL(`tel:${phone}`);

  const handleNavigate = async (app: 'google' | 'waze') => {
    if (!stop) return;
    const { lat, lng, address } = stop;
    const encodedAddress = encodeURIComponent(address);

    const urls = {
      google: {
        native: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
        web: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      },
      waze: {
        native: `waze://ul?ll=${lat},${lng}&navigate=yes`,
        web: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes&q=${encodedAddress}`,
      },
    };

    const { native, web } = urls[app];
    const canOpen = await Linking.canOpenURL(native);
    Linking.openURL(canOpen ? native : web);
  };

  const openNavigationSheet = () => {
    if (!stop || (stop.lat === 0 && stop.lng === 0)) return;
    const { Alert: RNAlert } = require('react-native');
    RNAlert.alert(
      'Navegar al destino',
      stop.address,
      [
        { text: 'Google Maps', onPress: () => handleNavigate('google') },
        { text: 'Waze', onPress: () => handleNavigate('waze') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const hasCargoDetails = stop.weightKg || stop.pieces || stop.cargoType || stop.volumeM3;
  const hasOriginContact = stop.originContactName || stop.originContactPhone;

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: '#cbd5e1', width: 36 }}
    >
      <BottomSheetScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}>

          {/* ── Header ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 26 }}>{isPassenger ? '🧑' : (STOP_TYPE_ICON[stop.type] ?? '📍')}</Text>
              <View>
                <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#0f172a' }}>
                  {isPassenger ? `Pasajero #${stopIndex + 1}` : `${STOP_TYPE_LABEL[stop.type] ?? 'Parada'} #${stopIndex + 1}`}
                </Text>
                {stop.trackingCode && (
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 1 }}>
                    {stop.trackingCode}
                  </Text>
                )}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <StopStatusBadge status={stop.status} />
              {stop.priority && stop.priority !== 'normal' && (
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: PRIORITY_COLOR[stop.priority] ?? '#64748b' }}>
                  {stop.priority === 'high' ? '⚡ Alta' : stop.priority === 'urgent' ? '🔴 Urgente' : stop.priority}
                </Text>
              )}
            </View>
          </View>

          {/* ── Description ── */}
          {stop.description && (
            <View style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#0f172a' }}>{stop.description}</Text>
              {stop.referenceNumber && (
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 4 }}>
                  Ref: {stop.referenceNumber}
                </Text>
              )}
            </View>
          )}

          {/* ── ETA / Distance ── */}
          {(stop.eta || stop.distanceKm) && stop.status === 'pending' && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {stop.eta && (
                <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, marginBottom: 2 }}>⏱</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#22c55e' }}>{stop.eta}</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: '#86efac' }}>ETA</Text>
                </View>
              )}
              {stop.distanceKm && (
                <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, marginBottom: 2 }}>📏</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#334155' }}>{stop.distanceKm.toFixed(1)} km</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: '#94a3b8' }}>Distancia</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Route ── */}
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <SectionLabel>Ruta</SectionLabel>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center', paddingTop: 2 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12 }}>📤</Text>
                </View>
                <View style={{ width: 1, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 4 }} />
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12 }}>📥</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginBottom: 2 }}>
                    {isPassenger ? 'Punto de recogida' : 'Origen'}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#334155' }}>
                    {stop.originAddress ?? 'Sin especificar'}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginBottom: 2 }}>
                    {isPassenger ? 'Punto de destino' : 'Destino'}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#0f172a' }}>{stop.address}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Destination contact ── */}
          {(stop.contactName || stop.contactPhone) && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <SectionLabel>{isPassenger ? 'Pasajero / Responsable' : 'Contacto en destino'}</SectionLabel>
              {stop.contactName && (
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#0f172a', marginBottom: 8 }}>
                  👤 {stop.contactName}
                </Text>
              )}
              {stop.contactPhone && (
                <TouchableOpacity
                  onPress={() => handleCall(stop.contactPhone!)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16, marginRight: 8 }}>📞</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#16a34a' }}>{stop.contactPhone}</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#86efac' }}>Llamar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Origin contact ── */}
          {hasOriginContact && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <SectionLabel>Contacto en origen</SectionLabel>
              {stop.originContactName && (
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#0f172a', marginBottom: 8 }}>
                  👤 {stop.originContactName}
                </Text>
              )}
              {stop.originContactPhone && (
                <TouchableOpacity
                  onPress={() => handleCall(stop.originContactPhone!)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16, marginRight: 8 }}>📞</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#475569' }}>{stop.originContactPhone}</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8' }}>Llamar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Cargo details ── */}
          {hasCargoDetails && !isPassenger && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <SectionLabel>Detalles de la carga</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {stop.cargoType && (
                  <View style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#64748b', marginBottom: 1 }}>Tipo</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#334155' }}>
                      {CARGO_TYPE_LABEL[stop.cargoType] ?? stop.cargoType}
                    </Text>
                  </View>
                )}
                {stop.weightKg && (
                  <View style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#64748b', marginBottom: 1 }}>Peso</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#334155' }}>{stop.weightKg} kg</Text>
                  </View>
                )}
                {stop.pieces && (
                  <View style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#64748b', marginBottom: 1 }}>Piezas</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#334155' }}>{stop.pieces}</Text>
                  </View>
                )}
                {stop.volumeM3 && (
                  <View style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#64748b', marginBottom: 1 }}>Volumen</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#334155' }}>{stop.volumeM3} m³</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Notes ── */}
          {stop.notes && (
            <View style={{ backgroundColor: '#fffbeb', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#fde68a' }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#92400e', marginBottom: 4 }}>📝 Notas</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#78350f' }}>{stop.notes}</Text>
            </View>
          )}

          {/* ── Delivered state ── */}
          {isCompleted && (
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: stop.podUrl ? 10 : 0 }}>
                <Text style={{ fontSize: 24 }}>✅</Text>
                <View>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#15803d' }}>
                    {isPassenger ? 'Llegó a destino' : 'Entregado'}
                  </Text>
                  {stop.deliveredAt && (
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#86efac' }}>
                      {new Date(stop.deliveredAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              </View>
              {stop.podSignedBy && (
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#16a34a', marginTop: 4 }}>
                  Firmado por: {stop.podSignedBy}
                </Text>
              )}
              {stop.podUrl && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(stop.podUrl!)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 14 }}>📸</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#15803d' }}>
                {isPassenger ? 'Ver confirmación' : 'Ver comprobante de entrega'}
              </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Failed state ── */}
          {isFailed && (
            <View style={{ backgroundColor: '#fef2f2', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#fecaca', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>❌</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#b91c1c' }}>
                {isPassenger ? 'Viaje cancelado' : 'Entrega fallida o cancelada'}
              </Text>
            </View>
          )}

          {/* ── Ver envío completo ── */}
          <TouchableOpacity
            onPress={() => {
              sheetRef.current?.dismiss();
              router.push(`/(app)/shipments/${stop.id}` as any);
            }}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14 }}
          >
            <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#22c55e', marginRight: 4 }}>
              {isPassenger ? 'Ver historial del traslado' : 'Ver historial completo del envío'}
            </Text>
            <Text style={{ fontSize: 13, color: '#22c55e' }}>→</Text>
          </TouchableOpacity>

          {/* ── Navegación ── */}
          {isActionable && stop.lat !== 0 && stop.lng !== 0 && (
            <TouchableOpacity
              onPress={openNavigationSheet}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginBottom: 10, backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0' }}
            >
              <Text style={{ fontSize: 16 }}>🧭</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#15803d' }}>
                Cómo llegar
              </Text>
            </TouchableOpacity>
          )}

          {/* ── CTA ── */}
          {isActionable && actionLabel && (
            <Button fullWidth size="lg" onPress={onAction}>
              {actionLabel}
            </Button>
          )}

          {onIncident && (
            <TouchableOpacity
              onPress={onIncident}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
            >
              <Text style={{ fontSize: 15 }}>⚠️</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#b91c1c' }}>
                No pude entregar
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
