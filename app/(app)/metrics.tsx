import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { DashboardService } from '../../src/services/api/dashboard.service';
import { DriversService } from '../../src/services/api/drivers.service';
import type { ExpenseByCategoryItem } from '../../src/services/api/dashboard.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
}

const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const EXPENSE_ICON: Record<string, string> = {
  fuel:        '⛽',
  toll:        '🛣',
  maintenance: '🔧',
  food:        '🍽',
  lodging:     '🏨',
  other:       '📎',
};

const EXPENSE_LABEL: Record<string, string> = {
  fuel:        'Combustible',
  toll:        'Casetas',
  maintenance: 'Mantenimiento',
  food:        'Alimentación',
  lodging:     'Hospedaje',
  other:       'Otros',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <View
      className={`flex-1 rounded-2xl p-4 border ${
        accent ? 'bg-primary-50 border-primary-200' : 'bg-white border-border'
      }`}
    >
      <Text className="text-xl mb-2">{icon}</Text>
      <Text
        className={`text-2xl font-bold ${accent ? 'text-primary-700' : 'text-text-primary'}`}
        style={{ fontFamily: 'Inter_700Bold' }}
      >
        {value}
      </Text>
      <Text
        className="text-xs text-text-secondary mt-0.5"
        style={{ fontFamily: 'Inter_400Regular' }}
      >
        {label}
      </Text>
      {sub && (
        <Text className="text-xs text-text-muted mt-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
          {sub}
        </Text>
      )}
    </View>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View className="mb-3 mt-5">
      <Text
        className="text-text-primary font-bold text-base"
        style={{ fontFamily: 'Inter_700Bold' }}
      >
        {title}
      </Text>
      {sub && (
        <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
          {sub}
        </Text>
      )}
    </View>
  );
}

function ExpenseBar({
  item,
  maxTotal,
}: {
  item: ExpenseByCategoryItem;
  maxTotal: number;
}) {
  const pct = maxTotal > 0 ? item.total / maxTotal : 0;
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-x-1.5">
          <Text className="text-sm">{EXPENSE_ICON[item.category] ?? '📎'}</Text>
          <Text className="text-text-primary text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
            {EXPENSE_LABEL[item.category] ?? item.category}
          </Text>
          <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            ({item.count})
          </Text>
        </View>
        <Text className="text-text-primary text-sm font-medium" style={{ fontFamily: 'Inter_600SemiBold' }}>
          {formatCurrency(item.total)}
        </Text>
      </View>
      <View className="h-2 bg-surface-secondary rounded-full overflow-hidden">
        <View
          className="h-full bg-primary-400 rounded-full"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MetricsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const driverId = useAuthStore((s) => s.driverId);
  const isOwner = user?.role === 'company_owner';
  const { from, to } = monthRange();
  const currentMonth = MONTH_LABELS[new Date().getMonth()];

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
    isRefetching: overviewRefetching,
  } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => DashboardService.getOverview(),
    staleTime: 2 * 60_000,
  });

  const {
    data: expenses,
    isLoading: expensesLoading,
    refetch: refetchExpenses,
    isRefetching: expensesRefetching,
  } = useQuery({
    queryKey: ['dashboard', 'expenses-by-category', from, to],
    queryFn: () => DashboardService.getExpensesByCategory({ from, to }),
    staleTime: 2 * 60_000,
  });

  const {
    data: driverStats,
    isLoading: statsLoading,
    refetch: refetchStats,
    isRefetching: statsRefetching,
  } = useQuery({
    queryKey: ['driver-stats', driverId],
    queryFn: () => DriversService.getStats(driverId!),
    enabled: !!driverId,
    staleTime: 5 * 60_000,
  });

  const isLoading = overviewLoading || expensesLoading || statsLoading;
  const isRefreshing = overviewRefetching || expensesRefetching || statsRefetching;

  const refetch = () => {
    refetchOverview();
    refetchExpenses();
    if (driverId) refetchStats();
  };

  const totalExpenses = expenses?.reduce((sum, e) => sum + e.total, 0) ?? 0;
  const maxExpense = expenses?.[0]?.total ?? 1;

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
            Mis métricas
          </Text>
          <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            {currentMonth} {new Date().getFullYear()}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
            Cargando métricas…
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-10"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor="#22c55e" />
          }
        >
          {/* ── Conductor ── */}
          {driverStats && (
            <>
              <SectionHeader title="Mi desempeño" />
              <View className="flex-row gap-x-3 mb-3">
                <KpiCard
                  icon="🚚"
                  label="Viajes totales"
                  value={driverStats.totalTrips}
                  accent
                />
                <KpiCard
                  icon="⭐"
                  label="Calificación"
                  value={driverStats.ratingAvg > 0 ? driverStats.ratingAvg.toFixed(1) : '—'}
                  sub="Promedio"
                />
              </View>
            </>
          )}

          {/* ── Envíos de la empresa ── */}
          {overview && (
            <>
              <SectionHeader
                title={isOwner ? 'Empresa' : 'Envíos'}
                sub="Estado actual"
              />
              <View className="flex-row gap-x-3 mb-3">
                <KpiCard
                  icon="📦"
                  label="Activos"
                  value={overview.shipments.active}
                  accent={overview.shipments.active > 0}
                />
                <KpiCard
                  icon="✅"
                  label="Completados"
                  value={overview.shipments.completed}
                />
                <KpiCard
                  icon="📊"
                  label="Total"
                  value={overview.shipments.total}
                />
              </View>

              {isOwner && (
                <>
                  <SectionHeader title="Flota" sub="Estado en tiempo real" />
                  <View className="flex-row gap-x-3 mb-3">
                    <KpiCard
                      icon="🚛"
                      label="En ruta"
                      value={overview.trucks.inTransit}
                      accent={overview.trucks.inTransit > 0}
                    />
                    <KpiCard
                      icon="🅿️"
                      label="Disponibles"
                      value={overview.trucks.available}
                    />
                    <KpiCard
                      icon="👥"
                      label="Conductores"
                      value={overview.drivers.total}
                    />
                  </View>

                  {overview.trucks.total > 0 && (
                    <View className="bg-white rounded-2xl border border-border p-4 mb-3">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text
                          className="text-text-secondary text-sm"
                          style={{ fontFamily: 'Inter_500Medium' }}
                        >
                          Utilización de flota
                        </Text>
                        <Text
                          className="text-primary-600 font-bold"
                          style={{ fontFamily: 'Inter_700Bold' }}
                        >
                          {Math.round(overview.trucks.utilization * 100)}%
                        </Text>
                      </View>
                      <View className="h-3 bg-surface-secondary rounded-full overflow-hidden">
                        <View
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${Math.round(overview.trucks.utilization * 100)}%` }}
                        />
                      </View>
                    </View>
                  )}

                  {overview.expenses.pendingApproval > 0 && (
                    <View className="flex-row items-center bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-3 gap-x-3">
                      <Text className="text-xl">⏳</Text>
                      <View>
                        <Text
                          className="text-amber-700 font-semibold text-sm"
                          style={{ fontFamily: 'Inter_600SemiBold' }}
                        >
                          {overview.expenses.pendingApproval} gasto{overview.expenses.pendingApproval !== 1 ? 's' : ''} por aprobar
                        </Text>
                        <Text className="text-amber-600 text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                          Pendientes de revisión
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Gastos del mes ── */}
          <SectionHeader
            title="Gastos del mes"
            sub={`${currentMonth} ${new Date().getFullYear()}`}
          />

          {!expenses || expenses.length === 0 ? (
            <View className="bg-white rounded-2xl border border-border p-6 items-center">
              <Text className="text-3xl mb-2">💰</Text>
              <Text
                className="text-text-muted text-sm text-center"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                Sin gastos registrados este mes
              </Text>
            </View>
          ) : (
            <View className="bg-white rounded-2xl border border-border p-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
                  Total del mes
                </Text>
                <Text
                  className="text-text-primary text-lg font-bold"
                  style={{ fontFamily: 'Inter_700Bold' }}
                >
                  {formatCurrency(totalExpenses)}
                </Text>
              </View>

              {expenses.map((item) => (
                <ExpenseBar key={item.category} item={item} maxTotal={maxExpense} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
