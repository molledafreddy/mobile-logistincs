import { useState } from 'react';
import { FlatList, View, Text, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExpensesService } from '../../../../src/services/api/expenses.service';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { Card } from '../../../../src/components/ui/Card';
import { ExpenseStatusBadge } from '../../../../src/components/ui/Badge';
import { Button } from '../../../../src/components/ui/Button';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Expense } from '../../../../src/types';

const APPROVER_ROLES = ['company_owner', 'admin', 'manager', 'dispatcher'];

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const formatCLP = (amount: number | string) => clpFormatter.format(Math.round(Number(amount)));

const CATEGORY_ICONS: Record<string, string> = {
  fuel: '⛽',
  toll: '🛣️',
  maintenance: '🔧',
  meal: '🍽️',
  parking: '🅿️',
  repair: '🛠️',
  lodging: '🏨',
  other: '📋',
};

const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Combustible',
  toll: 'Peaje',
  maintenance: 'Mantenimiento',
  meal: 'Alimentación',
  parking: 'Estacionamiento',
  repair: 'Reparación',
  lodging: 'Hospedaje',
  other: 'Otro',
};

function ExpenseCard({ expense }: { expense: Expense }) {
  return (
    <TouchableOpacity onPress={() => router.push(`/(app)/(tabs)/expenses/${expense.id}`)} activeOpacity={0.7}>
      <Card className="mb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-10 h-10 bg-surface-tertiary rounded-xl items-center justify-center mr-3">
              <Text className="text-xl">{CATEGORY_ICONS[expense.category] ?? '📋'}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                {CATEGORY_LABELS[expense.category] ?? expense.category}
              </Text>
              <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                {format(new Date(expense.createdAt), "d MMM yyyy", { locale: es })}
              </Text>
              {expense.description && (
                <Text className="text-text-secondary text-xs mt-0.5" numberOfLines={1} style={{ fontFamily: 'Inter_400Regular' }}>
                  {expense.description}
                </Text>
              )}
            </View>
          </View>
          <View className="items-end">
            <Text className="text-text-primary font-semibold mb-1" style={{ fontFamily: 'Inter_600SemiBold' }}>
              {formatCLP(expense.amount)}
            </Text>
            <ExpenseStatusBadge status={expense.status} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function ApprovalCard({
  expense,
  onApprove,
  onReject,
  isLoading,
}: {
  expense: Expense;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}) {
  return (
    <TouchableOpacity onPress={() => router.push(`/(app)/(tabs)/expenses/${expense.id}`)} activeOpacity={0.7}>
      <Card className="mb-3">
        <View className="flex-row items-center mb-3">
          <View className="w-10 h-10 bg-surface-tertiary rounded-xl items-center justify-center mr-3">
            <Text className="text-xl">{CATEGORY_ICONS[expense.category] ?? '📋'}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
              {CATEGORY_LABELS[expense.category] ?? expense.category}
            </Text>
            <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              {format(new Date(expense.createdAt), "d MMM yyyy · HH:mm", { locale: es })}
            </Text>
            {expense.description && (
              <Text className="text-text-secondary text-xs mt-0.5" numberOfLines={2} style={{ fontFamily: 'Inter_400Regular' }}>
                {expense.description}
              </Text>
            )}
          </View>
          <View className="items-end ml-3">
            <Text className="text-text-primary font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
              {formatCLP(expense.amount)}
            </Text>
            <Text className="text-text-muted text-xs mt-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
              #{expense.id.slice(-6).toUpperCase()}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onReject(); }}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl border border-red-500 items-center"
          >
            <Text className="text-red-500 text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
              Rechazar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onApprove(); }}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl items-center"
            style={{ backgroundColor: '#22c55e' }}
          >
            <Text className="text-white text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
              Aprobar
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

type Tab = 'mine' | 'pending';

export default function ExpensesScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canApprove = !!user?.role && APPROVER_ROLES.includes(user.role);

  const [activeTab, setActiveTab] = useState<Tab>('mine');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['expenses', 'my'],
    queryFn: () => ExpensesService.getMyExpenses({ limit: 50 }),
  });

  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending, isRefetching: pendingRefetching } = useQuery({
    queryKey: ['expenses', 'pending'],
    queryFn: () => ExpensesService.getPendingExpenses(),
    enabled: canApprove,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => ExpensesService.approveExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['expenses', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => Alert.alert('Error', 'No se pudo aprobar el gasto.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => ExpensesService.rejectExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['expenses', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => Alert.alert('Error', 'No se pudo rechazar el gasto.'),
  });

  const handleApprove = (expense: Expense) => {
    Alert.alert(
      'Aprobar gasto',
      `¿Confirmar aprobación de ${formatCLP(expense.amount)} (${CATEGORY_LABELS[expense.category] ?? expense.category})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprobar', onPress: () => approveMutation.mutate(expense.id) },
      ]
    );
  };

  const handleReject = (expense: Expense) => {
    Alert.alert(
      'Rechazar gasto',
      `¿Rechazar el gasto de ${formatCLP(expense.amount)}? El conductor recibirá una notificación.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Rechazar', style: 'destructive', onPress: () => rejectMutation.mutate(expense.id) },
      ]
    );
  };

  const mutationLoading = approveMutation.isPending || rejectMutation.isPending;

  const myExpenses = data?.data ?? [];
  const pendingExpenses = pendingData?.data ?? [];
  const pendingCount = pendingData?.total ?? pendingExpenses.length;
  const total = myExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary">
      {/* Header */}
      <View className="px-4 pt-4 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl text-text-primary" style={{ fontFamily: 'Inter_700Bold' }}>
            Gastos
          </Text>
          {activeTab === 'mine' && myExpenses.length > 0 && (
            <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
              Total: {formatCLP(total)}
            </Text>
          )}
          {activeTab === 'pending' && (
            <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        {activeTab === 'mine' && (
          <Button
            variant="primary"
            size="sm"
            onPress={() => router.push('/(app)/(tabs)/expenses/new')}
          >
            + Nuevo
          </Button>
        )}
      </View>

      {/* Tab toggle — only for approver roles */}
      {canApprove && (
        <View className="flex-row mx-4 mb-3 bg-surface-tertiary rounded-xl p-1">
          <TouchableOpacity
            onPress={() => setActiveTab('mine')}
            className="flex-1 py-2 rounded-lg items-center"
            style={activeTab === 'mine' ? { backgroundColor: '#ffffff', elevation: 1 } : undefined}
          >
            <Text
              className={`text-sm ${activeTab === 'mine' ? 'text-text-primary font-semibold' : 'text-text-muted'}`}
              style={{ fontFamily: activeTab === 'mine' ? 'Inter_600SemiBold' : 'Inter_400Regular' }}
            >
              Mis gastos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('pending')}
            className="flex-1 py-2 rounded-lg items-center"
            style={activeTab === 'pending' ? { backgroundColor: '#ffffff', elevation: 1 } : undefined}
          >
            <View className="flex-row items-center gap-1.5">
              <Text
                className={`text-sm ${activeTab === 'pending' ? 'text-text-primary font-semibold' : 'text-text-muted'}`}
                style={{ fontFamily: activeTab === 'pending' ? 'Inter_600SemiBold' : 'Inter_400Regular' }}
              >
                Por aprobar
              </Text>
              {pendingCount > 0 && (
                <View className="bg-primary rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                  <Text className="text-white text-xs font-bold" style={{ fontFamily: 'Inter_700Bold', fontSize: 10 }}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* My expenses list */}
      {activeTab === 'mine' && (
        <FlatList
          data={myExpenses}
          keyExtractor={(e) => e.id}
          contentContainerClassName="px-4 pb-8 flex-grow"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" />
          }
          renderItem={({ item }) => <ExpenseCard expense={item} />}
          ListEmptyComponent={
            isLoading ? null : (
              <EmptyState
                icon="💰"
                title="Sin gastos registrados"
                description="Registra tus gastos de viaje aquí."
                actionLabel="Registrar gasto"
                onAction={() => router.push('/(app)/(tabs)/expenses/new')}
              />
            )
          }
        />
      )}

      {/* Pending approval list */}
      {activeTab === 'pending' && (
        <FlatList
          data={pendingExpenses}
          keyExtractor={(e) => e.id}
          contentContainerClassName="px-4 pb-8 flex-grow"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={pendingRefetching} onRefresh={refetchPending} tintColor="#22c55e" />
          }
          renderItem={({ item }) => (
            <ApprovalCard
              expense={item}
              onApprove={() => handleApprove(item)}
              onReject={() => handleReject(item)}
              isLoading={mutationLoading}
            />
          )}
          ListEmptyComponent={
            pendingLoading ? null : (
              <EmptyState
                icon="✅"
                title="Sin gastos pendientes"
                description="No hay gastos esperando aprobación."
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
