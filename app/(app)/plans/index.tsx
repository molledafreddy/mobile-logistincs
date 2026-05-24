import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlansService } from '../../../src/services/api/plans.service';
import { SubscriptionsService } from '../../../src/services/api/subscriptions.service';
import { BillingService } from '../../../src/services/api/billing.service';
import { useAuthStore } from '../../../src/stores/auth.store';
import type { Plan, Subscription } from '../../../src/types';

// ─── Labels ──────────────────────────────────────────────────────────────────

const AUDIENCE_LABEL: Record<string, string> = {
  courier:   'Courier / Repartidor',
  passenger: 'Transporte de Pasajeros',
  fleet:     'Flota Empresarial',
  any:       'Multi-vertical',
};

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  free:       { label: 'Gratis',     color: '#16a34a', bg: '#dcfce7' },
  pro:        { label: 'Pro',        color: '#2563eb', bg: '#eff6ff' },
  enterprise: { label: 'Enterprise', color: '#7c3aed', bg: '#f5f3ff' },
};

const LIMIT_LABEL: Record<string, string> = {
  maxShipmentsPerDay:      'Envíos por día',
  maxStopsPerOptimization: 'Paradas por optimización',
  max_trucks:              'Vehículos',
  max_drivers:             'Conductores',
  max_templates:           'Plantillas',
  maxRidesPerDay:          'Rides por día',
};

// Permisos agrupados por categoría para mostrar en la pantalla
const PERMISSION_GROUPS: { label: string; icon: string; permissions: string[] }[] = [
  {
    label: 'Envíos',
    icon: 'cube-outline',
    permissions: ['shipments.read', 'shipments.write'],
  },
  {
    label: 'Conductores y Vehículos',
    icon: 'car-outline',
    permissions: ['drivers.read', 'drivers.write', 'trucks.read', 'trucks.write'],
  },
  {
    label: 'Optimización de Rutas',
    icon: 'navigate-outline',
    permissions: [
      'optimization.basic',
      'optimization.advanced',
      'optimization.google_maps',
      'optimization.vrp',
      'optimization.reoptimize',
      'routes.multi_driver',
    ],
  },
  {
    label: 'Plantillas y Recurrencia',
    icon: 'repeat-outline',
    permissions: ['templates.basic', 'passenger.recurring', 'passenger.manifest'],
  },
  {
    label: 'Red y Tracking',
    icon: 'globe-outline',
    permissions: [
      'network.receive_packages',
      'network.publish_packages',
      'tracking.public_link',
    ],
  },
  {
    label: 'Reportes y Configuración',
    icon: 'bar-chart-outline',
    permissions: ['reports.advanced', 'settings.billing'],
  },
];

const PERMISSION_LABEL: Record<string, string> = {
  'shipments.read':            'Consultar envíos',
  'shipments.write':           'Crear y gestionar envíos',
  'drivers.read':              'Consultar conductores',
  'drivers.write':             'Gestionar conductores',
  'trucks.read':               'Consultar vehículos',
  'trucks.write':              'Gestionar vehículos',
  'optimization.basic':        'Optimización básica',
  'optimization.advanced':     'Optimización avanzada (Mapbox)',
  'optimization.google_maps':  'Google Maps Routes API',
  'optimization.vrp':          'VRP multi-vehículo',
  'optimization.reoptimize':   'Reoptimización dinámica',
  'routes.multi_driver':       'Multi-conductor por ruta',
  'templates.basic':           'Plantillas de recurrencia',
  'passenger.recurring':       'Viajes recurrentes',
  'passenger.manifest':        'Manifiestos de pasajeros',
  'network.receive_packages':  'Recibir paquetes de la red',
  'network.publish_packages':  'Publicar paquetes a la red',
  'tracking.public_link':      'Link público de seguimiento',
  'reports.advanced':          'Reportes avanzados',
  'settings.billing':          'Gestión de facturación',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCLP(amount: number) {
  if (amount === 0) return 'Gratis';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function isUnlimited(value: number) {
  return value >= 9999;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LimitRow({ label, value }: { label: string; value: number }) {
  const display = isUnlimited(value) ? 'Ilimitado' : String(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 8 }}>
      <Ionicons name="analytics-outline" size={13} color="#94a3b8" />
      <Text style={{ fontSize: 12, color: '#475569', flex: 1 }}>
        {label}:{' '}
        <Text style={{ fontWeight: '600', color: '#0f172a' }}>{display}</Text>
      </Text>
    </View>
  );
}

function PermissionRow({ code, granted }: { code: string; granted: boolean }) {
  const label = PERMISSION_LABEL[code] ?? code;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 8 }}>
      <Ionicons
        name={granted ? 'checkmark-circle' : 'close-circle-outline'}
        size={14}
        color={granted ? '#22c55e' : '#cbd5e1'}
      />
      <Text style={{
        fontSize: 12,
        color: granted ? '#334155' : '#94a3b8',
        flex: 1,
        textDecorationLine: granted ? 'none' : 'none',
      }}>
        {label}
      </Text>
    </View>
  );
}

function PermissionsSection({
  planPermissions,
  expanded,
  onToggle,
}: {
  planPermissions: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const permSet = new Set(planPermissions);
  const allPermissions = PERMISSION_GROUPS.flatMap((g) => g.permissions);

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12, marginTop: 4 }}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? 12 : 0 }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>
          Permisos y accesos
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="#94a3b8"
        />
      </TouchableOpacity>

      {expanded && (
        <>
          {PERMISSION_GROUPS.map((group) => {
            const relevant = group.permissions.filter((p) => allPermissions.includes(p));
            if (!relevant.length) return null;
            return (
              <View key={group.label} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <Ionicons name={group.icon as any} size={12} color="#64748b" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {group.label}
                  </Text>
                </View>
                {relevant.map((perm) => (
                  <PermissionRow key={perm} code={perm} granted={permSet.has(perm)} />
                ))}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

interface PlanCardProps {
  plan: Plan;
  currentSubscription: Subscription | undefined;
  canManage: boolean;
  onActivate: (plan: Plan) => void;
  isActivating: boolean;
}

function PlanCard({ plan, currentSubscription, canManage, onActivate, isActivating }: PlanCardProps) {
  const [permExpanded, setPermExpanded] = useState(false);
  const tierCfg = plan.tier ? TIER_CONFIG[plan.tier] : null;
  const isFree = plan.price === 0;
  const isPro = plan.tier === 'pro';
  const isEnterprise = plan.tier === 'enterprise';
  const isCurrentPlan = currentSubscription?.plan_id === plan.id;
  const hasActiveSub = !!currentSubscription && currentSubscription.status === 'active';

  // Collect limit rows from plan.limits jsonb
  const limitEntries: { label: string; value: number }[] = [];
  for (const group of Object.values(plan.limits ?? {})) {
    if (typeof group !== 'object') continue;
    for (const [key, val] of Object.entries(group)) {
      const label = LIMIT_LABEL[key];
      if (label) limitEntries.push({ label, value: Number(val) });
    }
  }

  // Permissions come from plan.planPermissions or plan.permissions (depending on API shape)
  const planPermissions: string[] = (plan as any).permissions ?? [];

  const borderColor = isCurrentPlan ? '#22c55e' : isEnterprise ? '#7c3aed' : isPro ? '#2563eb' : 'transparent';
  const borderWidth = isCurrentPlan || isEnterprise || isPro ? (isCurrentPlan ? 2 : 1.5) : 0;

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        borderWidth,
        borderColor,
      }}
    >
      {/* Plan actual badge */}
      {isCurrentPlan && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10,
          backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 5,
          borderRadius: 10, alignSelf: 'flex-start',
        }}>
          <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#16a34a' }}>Plan actual</Text>
        </View>
      )}

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>{plan.name}</Text>
            {tierCfg && (
              <View style={{ backgroundColor: tierCfg.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: tierCfg.color }}>{tierCfg.label}</Text>
              </View>
            )}
          </View>
          {plan.audience && (
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              {AUDIENCE_LABEL[plan.audience] ?? plan.audience}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: isFree ? '#16a34a' : '#0f172a' }}>
            {formatCLP(plan.price)}
          </Text>
          {!isFree && (
            <Text style={{ fontSize: 11, color: '#94a3b8' }}>/ mes</Text>
          )}
        </View>
      </View>

      {/* Description */}
      {plan.description ? (
        <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          {plan.description}
        </Text>
      ) : null}

      {/* Limits */}
      {limitEntries.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Capacidades
          </Text>
          {limitEntries.map((item) => (
            <LimitRow key={item.label} label={item.label} value={item.value} />
          ))}
        </View>
      )}

      {/* Permissions section (expandable) */}
      <PermissionsSection
        planPermissions={planPermissions}
        expanded={permExpanded}
        onToggle={() => setPermExpanded((v) => !v)}
      />

      {/* Action button */}
      {canManage && !isCurrentPlan && (
        <TouchableOpacity
          onPress={() => onActivate(plan)}
          disabled={isActivating}
          activeOpacity={0.8}
          style={{
            marginTop: 14,
            backgroundColor: isEnterprise ? '#7c3aed' : isPro ? '#2563eb' : '#22c55e',
            borderRadius: 12,
            paddingVertical: 13,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            opacity: isActivating ? 0.6 : 1,
          }}
        >
          {isActivating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons
                name={isFree ? 'checkmark-circle-outline' : 'card-outline'}
                size={16}
                color="#fff"
              />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                {hasActiveSub ? 'Cambiar a este plan' : isFree ? 'Activar gratis' : 'Contratar y pagar'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function GroupedPlans({
  plans, currentSubscription, canManage, onActivate, activatingPlanId,
}: {
  plans: Plan[];
  currentSubscription: Subscription | undefined;
  canManage: boolean;
  onActivate: (plan: Plan) => void;
  activatingPlanId: string | null;
}) {
  const byAudience = plans.reduce<Record<string, Plan[]>>((acc, plan) => {
    const key = plan.audience ?? 'any';
    if (!acc[key]) acc[key] = [];
    acc[key].push(plan);
    return acc;
  }, {});

  const audienceOrder = ['courier', 'passenger', 'fleet', 'any'];
  const sorted = audienceOrder.filter((a) => byAudience[a]);

  return (
    <>
      {sorted.map((audience) => (
        <View key={audience}>
          {sorted.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 6 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {AUDIENCE_LABEL[audience] ?? audience}
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
            </View>
          )}
          {byAudience[audience].map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentSubscription={currentSubscription}
              canManage={canManage}
              onActivate={onActivate}
              isActivating={activatingPlanId === plan.id}
            />
          ))}
        </View>
      ))}
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlansScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = ['company_owner', 'admin', 'manager'].includes(user?.role ?? '');

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['plans', 'catalog'],
    queryFn: () => PlansService.getCatalog(),
    staleTime: 10 * 60_000,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions', user?.companyId],
    queryFn: () => SubscriptionsService.getByCompany(user!.companyId!),
    enabled: !!user?.companyId,
    staleTime: 2 * 60_000,
  });

  const activeSub = subscriptions?.find((s) => s.status === 'active') ?? subscriptions?.[0];

  const activateMutation = useMutation({
    mutationFn: async ({ plan }: { plan: Plan }) => {
      let subscriptionId: string;

      if (activeSub) {
        await SubscriptionsService.upgrade(activeSub.id, plan.id);
        subscriptionId = activeSub.id;
      } else {
        const sub = await SubscriptionsService.activatePlan(user!.companyId!, plan.id);
        subscriptionId = sub.id;
      }

      if (plan.price > 0) {
        const checkout = await BillingService.createCheckout({
          subscriptionId,
          amount: Math.round(plan.price),
          currency: 'CLP',
          itemTitle: `Plan ${plan.name} — Mensual`,
          payerEmail: user?.email ?? undefined,
        });
        return { isFree: false, initPoint: checkout.initPoint };
      }

      return { isFree: true, initPoint: null };
    },
    onSuccess: async ({ isFree, initPoint }) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'renewal'] });

      if (!isFree && initPoint) {
        try {
          await Linking.openURL(initPoint);
        } catch {
          Alert.alert('Error', 'No se pudo abrir la pasarela de pago.');
        }
      } else {
        Alert.alert(
          '¡Plan activado!',
          'Tu suscripción gratuita está activa.',
          [
            { text: 'Ver suscripción', onPress: () => router.replace('/(app)/billing' as any) },
            { text: 'Continuar', style: 'cancel' },
          ],
        );
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo procesar la solicitud.';
      Alert.alert('Error', msg);
    },
  });

  const handleActivate = (plan: Plan) => {
    const isFree = plan.price === 0;
    const actionLabel = activeSub ? 'Cambiar de plan' : isFree ? 'Activar plan gratuito' : 'Contratar plan';
    const message = isFree
      ? `¿Activar el plan "${plan.name}" de forma gratuita?`
      : `El plan "${plan.name}" tiene un costo de ${formatCLP(plan.price)}/mes.\n\nSe redirigirá a MercadoPago para completar el pago.`;

    Alert.alert(actionLabel, message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: isFree ? 'Activar' : 'Ir a pagar',
        onPress: () => activateMutation.mutate({ plan }),
      },
    ]);
  };

  const activatingPlanId = activateMutation.isPending
    ? (activateMutation.variables?.plan.id ?? null)
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#0f172a' }}>Planes disponibles</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
            Elige el plan que mejor se adapte a tu operación
          </Text>
        </View>
      </View>

      {plansLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      ) : !plans?.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="grid-outline" size={40} color="#94a3b8" />
          <Text style={{ fontSize: 15, fontWeight: '500', color: '#64748b', marginTop: 12, textAlign: 'center' }}>
            No hay planes disponibles en este momento.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {/* Suscripción activa */}
          {activeSub && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
            }}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={{ fontSize: 13, color: '#15803d', flex: 1 }}>
                Ya tienes una suscripción activa. Puedes cambiar de plan seleccionando otro.
              </Text>
            </View>
          )}

          {/* Aviso pago */}
          {canManage && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
            }}>
              <Ionicons name="card" size={16} color="#2563eb" />
              <Text style={{ fontSize: 12, color: '#1d4ed8', flex: 1 }}>
                Los pagos se procesan de forma segura a través de MercadoPago. Expande cada plan para ver sus permisos detallados.
              </Text>
            </View>
          )}

          <GroupedPlans
            plans={plans}
            currentSubscription={activeSub}
            canManage={canManage}
            onActivate={handleActivate}
            activatingPlanId={activatingPlanId}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
