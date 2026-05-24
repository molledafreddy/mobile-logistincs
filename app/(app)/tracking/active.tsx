import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTrackingStore } from '../../../src/stores/tracking.store';
import { DeliveryRunsService } from '../../../src/services/api/delivery-runs.service';
import { GeocodingService } from '../../../src/services/api/geocoding.service';
import { SocketService } from '../../../src/services/socket/socket.service';
import { SocketEvent } from '../../../src/services/socket/socket.events';
import { Card } from '../../../src/components/ui/Card';
import type { EtaStop, LocationUpdate } from '../../../src/types';

export default function ActiveTrackingScreen() {
  const router = useRouter();
  const { runId: paramRunId } = useLocalSearchParams<{ runId?: string }>();
  const mapRef = useRef<MapView>(null);
  const { activeRunId: storeRunId, lastLocation, updateLocation, isTracking } = useTrackingStore();
  const activeRunId = storeRunId ?? paramRunId ?? null;


  const { data: run } = useQuery({
    queryKey: ['delivery-runs', activeRunId],
    queryFn: () => DeliveryRunsService.getRunById(activeRunId!),
    enabled: !!activeRunId,
    refetchInterval: 30_000,
  });

  const { data: etas } = useQuery({
    queryKey: ['run-etas', activeRunId],
    queryFn: () => DeliveryRunsService.getRunEtas(activeRunId!),
    enabled: !!activeRunId && isTracking,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Listen to own location updates from WebSocket (echoed back)
  useEffect(() => {
    const unsub = SocketService.on<LocationUpdate>(SocketEvent.LOCATION_UPDATE, (data) => {
      updateLocation(data);
      mapRef.current?.animateToRegion(
        { latitude: data.lat, longitude: data.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    });
    return unsub;
  }, [updateLocation]);

  const pendingStops = run?.stops.filter((s) => s.status === 'pending') ?? [];
  const completedStops = run?.stops.filter((s) => s.status === 'delivered') ?? [];

  const initialRegion = lastLocation
    ? { latitude: lastLocation.lat, longitude: lastLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : pendingStops[0]
    ? { latitude: pendingStops[0].lat, longitude: pendingStops[0].lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: -33.45, longitude: -70.65, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  // Map stopId → ETA for quick lookup
  const etaByStop = (etas?.stops ?? []).reduce<Record<string, EtaStop>>((acc, e) => {
    acc[e.stopId] = e;
    return acc;
  }, {});

  const nextStop = pendingStops[0];
  const nextEta = nextStop ? etaByStop[nextStop.id] : undefined;

  // Round to 3 decimal places (~110m) so we don't re-geocode on every GPS tick
  const roundedLat = lastLocation ? Math.round(lastLocation.lat * 1000) / 1000 : null;
  const roundedLng = lastLocation ? Math.round(lastLocation.lng * 1000) / 1000 : null;

  const { data: currentAddress } = useQuery({
    queryKey: ['geocoding', 'reverse', roundedLat, roundedLng],
    queryFn: () => GeocodingService.reverse(lastLocation!.lat, lastLocation!.lng),
    enabled: !!lastLocation,
    staleTime: 60_000,
    select: (feature) => feature?.formatted ?? null,
  });

  return (
    <View className="flex-1">
      {/* Map — full screen */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Pending stops with ETA callout */}
        {pendingStops.map((stop, idx) => {
          const eta = etaByStop[stop.id];
          const isNext = stop.id === nextStop?.id;
          return (
            <Marker
              key={stop.id}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              title={`${isNext ? '🔴 Próxima · ' : ''}Parada ${idx + 1}${eta ? ` · ${eta.etaMinutes} min` : ''}`}
              description={stop.address}
              pinColor={isNext ? '#ef4444' : '#22c55e'}
            />
          );
        })}

        {/* Completed stops (grey) */}
        {completedStops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            pinColor="#94a3b8"
          />
        ))}

        {/* Route line */}
        {pendingStops.length > 1 && (
          <Polyline
            coordinates={pendingStops.map((s) => ({ latitude: s.lat, longitude: s.lng }))}
            strokeColor="#22c55e"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Top bar */}
      <SafeAreaView className="absolute top-0 left-0 right-0" edges={['top']}>
        <View className="flex-row items-center px-4 pt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-md border border-border"
          >
            <Text className="text-text-primary">←</Text>
          </TouchableOpacity>

          {isTracking && (
            <View className="ml-3 bg-white rounded-full px-3 py-1.5 flex-row items-center shadow-sm border border-border">
              <View className="w-2 h-2 bg-primary-500 rounded-full mr-2" />
              <Text className="text-text-primary text-xs font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                Tracking activo
              </Text>
            </View>
          )}

          {/* Total route summary chip */}
          {etas && (
            <View className="ml-2 bg-white rounded-full px-3 py-1.5 flex-row items-center shadow-sm border border-border">
              <Text className="text-text-secondary text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                🏁 {etas.totalDurationMinutes ?? '--'} min · {etas.totalDistanceKm?.toFixed(1) ?? '--'} km
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Bottom info card */}
      <View className="absolute bottom-0 left-0 right-0 pb-8 px-4">
        <Card>
          {run ? (
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-text-primary font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Run #{run.id.slice(-6).toUpperCase()}
                </Text>
                <Text className="text-primary-600 font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  {run.completedStops}/{run.totalStops} paradas
                </Text>
              </View>

              {/* Current position */}
              {lastLocation && (
                <View className="flex-row items-center mb-3">
                  <Text className="text-text-muted text-xs mr-1.5">📍</Text>
                  <Text
                    className="text-text-secondary text-xs flex-1"
                    numberOfLines={1}
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    {currentAddress ?? 'Calculando posición...'}
                  </Text>
                </View>
              )}

              {/* Speed + Next ETA row */}
              <View className="flex-row gap-x-4 mb-3">
                {lastLocation && (
                  <View className="flex-row items-center">
                    <Text className="text-text-muted text-xs mr-1">🏎</Text>
                    <Text className="text-text-secondary text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                      {Math.round((lastLocation.speed ?? 0) * 3.6)} km/h
                    </Text>
                  </View>
                )}
                {nextEta && (
                  <View className="flex-row items-center">
                    <Text className="text-text-muted text-xs mr-1">⏱</Text>
                    <Text className="text-primary-600 text-xs font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                      Próxima parada: {nextEta.etaMinutes ?? '--'} min · {nextEta.distanceKm?.toFixed(1) ?? '--'} km
                    </Text>
                  </View>
                )}
              </View>

              {/* Next stop address */}
              {nextStop && (
                <View className="bg-surface-secondary rounded-xl px-3 py-2 mb-3">
                  <Text className="text-text-muted text-xs mb-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
                    Siguiente parada
                  </Text>
                  <Text
                    className="text-text-primary text-sm font-medium"
                    numberOfLines={1}
                    style={{ fontFamily: 'Inter_500Medium' }}
                  >
                    {nextStop.address}
                  </Text>
                  {nextEta && (
                    <Text className="text-primary-600 text-xs mt-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
                      Llegada estimada: {nextEta.etaTime}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                onPress={() => router.push(`/(app)/delivery/${activeRunId}`)}
                className="bg-primary-500 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Ver paradas →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text className="text-text-muted text-center" style={{ fontFamily: 'Inter_400Regular' }}>
              Cargando run...
            </Text>
          )}
        </Card>
      </View>
    </View>
  );
}
