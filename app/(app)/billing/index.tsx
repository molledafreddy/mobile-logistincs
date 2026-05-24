import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BillingService } from '../../../src/services/api/billing.service';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  active:          { label: 'Activo',          color: '#16a34a', bg: '#dcfce7', icon: 'checkmark-circle' },
  pending_payment: { label: 'Pago pendiente',  color: '#d97706', bg: '#fef3c7', icon: 'time' },
  suspended:       { label: 'Suspendida',      color: '#dc2626', bg: '#fee2e2', icon: 'warning' },
  canceled:        { label: 'Cancelada',       color: '#64748b', bg: '#f1f5f9', icon: 'close-circle' },
};

function formatCLP(amount: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
}

export default function BillingScreen() {
  const [isOpeningUrl, setIsOpeningUrl] = useState(false);

  const { data: renewal, isLoading, error, refetch } = useQuery({
    queryKey: ['billing', 'renewal'],
    queryFn: () => BillingService.getMyRenewal(),
    retry: false,
  });

  const retryMutation = useMutation({
    mutationFn: () => BillingService.retry(),
    onSuccess: async (result) => {
      setIsOpeningUrl(true);
      try {
        await Linking.openURL(result.initPoint);
      } catch {
        Alert.alert('Error', 'No se pudo abrir el enlace de pago. Inténtalo de nuevo.');
      } finally {
        setIsOpeningUrl(false);
      }
      refetch();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Ocurrió un error al generar el cobro.';
      Alert.alert('Error', msg);
    },
  });

  const handlePay = async (initPoint: string) => {
    setIsOpeningUrl(true);
    try {
      await Linking.openURL(initPoint);
    } catch {
      Alert.alert('Error', 'No se pudo abrir el enlace de pago.');
    } finally {
      setIsOpeningUrl(false);
    }
  };

  const handleRetry = () => {
    Alert.alert(
      'Generar nuevo cobro',
      'Se creará un nuevo enlace de pago. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => retryMutation.mutate() },
      ],
    );
  };

  const statusCfg = renewal ? (STATUS_CONFIG[renewal.status] ?? STATUS_CONFIG['active']) : null;
  const isPending = renewal?.status === 'pending_payment' || renewal?.status === 'suspended';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: '#0f172a' }}>Suscripción y pagos</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="card-outline" size={32} color="#94a3b8" />
          </View>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#334155', textAlign: 'center', marginBottom: 8 }}>
            Sin suscripción activa
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8', textAlign: 'center', marginBottom: 24 }}>
            Tu empresa aún no tiene un plan asignado. Contacta con soporte para activar uno.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/plans' as any)}
            style={{ backgroundColor: '#22c55e', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Ver planes</Text>
          </TouchableOpacity>
        </View>
      ) : renewal && statusCfg ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {/* Status banner */}
          {isPending && (
            <View style={{ backgroundColor: renewal.status === 'suspended' ? '#fee2e2' : '#fef3c7', borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Ionicons
                name={renewal.status === 'suspended' ? 'warning' : 'time'}
                size={20}
                color={renewal.status === 'suspended' ? '#dc2626' : '#d97706'}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: renewal.status === 'suspended' ? '#991b1b' : '#92400e', marginBottom: 2 }}>
                  {renewal.status === 'suspended' ? 'Servicio suspendido' : 'Pago pendiente'}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: renewal.status === 'suspended' ? '#b91c1c' : '#b45309' }}>
                  {renewal.status === 'suspended'
                    ? 'Tu servicio está suspendido por falta de pago. Realiza el pago para reactivarlo.'
                    : 'Tienes un pago pendiente. Completa el pago para mantener el servicio activo.'}
                </Text>
              </View>
            </View>
          )}

          {/* Plan card */}
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginBottom: 4 }}>Plan actual</Text>
                <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#0f172a' }}>{renewal.planName}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: statusCfg.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                <Ionicons name={statusCfg.icon} size={13} color={statusCfg.color} />
                <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: statusCfg.color, marginLeft: 4 }}>
                  {statusCfg.label}
                </Text>
              </View>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#64748b' }}>Monto mensual</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#0f172a' }}>
                  {formatCLP(renewal.amount)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#64748b' }}>Próxima renovación</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#0f172a' }}>
                  {format(new Date(renewal.currentPeriodEnd), "d 'de' MMMM, yyyy", { locale: es })}
                </Text>
              </View>
              {renewal.gracePeriodUntil && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#64748b' }}>Gracia hasta</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#d97706' }}>
                    {format(new Date(renewal.gracePeriodUntil), "d 'de' MMMM, yyyy", { locale: es })}
                  </Text>
                </View>
              )}
              {renewal.lastRenewalAttemptAt && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#64748b' }}>Último intento</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8' }}>
                    {format(new Date(renewal.lastRenewalAttemptAt), "d MMM yyyy · HH:mm", { locale: es })}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Pay button — shown when there's a pending initPoint */}
          {renewal.initPoint && isPending && (
            <TouchableOpacity
              onPress={() => handlePay(renewal.initPoint!)}
              disabled={isOpeningUrl}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#22c55e',
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                marginBottom: 12,
                shadowColor: '#22c55e',
                shadowOpacity: 0.35,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
                opacity: isOpeningUrl ? 0.7 : 1,
              }}
            >
              {isOpeningUrl ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 }}>Pagar ahora</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Retry button — generate a new checkout if no initPoint or as fallback */}
          {isPending && (
            <TouchableOpacity
              onPress={handleRetry}
              disabled={retryMutation.isPending || isOpeningUrl}
              activeOpacity={0.8}
              style={{
                borderWidth: 1.5,
                borderColor: '#22c55e',
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                marginBottom: 16,
                opacity: retryMutation.isPending ? 0.6 : 1,
              }}
            >
              {retryMutation.isPending ? (
                <ActivityIndicator color="#22c55e" />
              ) : (
                <Text style={{ color: '#22c55e', fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>
                  {renewal.initPoint ? 'Generar nuevo enlace de pago' : 'Generar enlace de pago'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* View plans link */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/plans' as any)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 }}
          >
            <Ionicons name="grid-outline" size={16} color="#64748b" />
            <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#64748b' }}>Ver todos los planes</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
