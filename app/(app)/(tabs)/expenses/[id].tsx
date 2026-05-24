import { View, Text, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExpensesService } from '../../../../src/services/api/expenses.service';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { ExpenseStatusBadge } from '../../../../src/components/ui/Badge';

const APPROVER_ROLES = ['company_owner', 'admin', 'manager', 'dispatcher'];

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const formatCLP = (amount: number | string) => clpFormatter.format(Math.round(Number(amount)));

const CATEGORY_ICONS: Record<string, string> = {
  fuel: '⛽', toll: '🛣️', maintenance: '🔧', meal: '🍽️',
  parking: '🅿️', repair: '🛠️', lodging: '🏨', other: '📋',
};

const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Combustible', toll: 'Peaje', maintenance: 'Mantenimiento',
  meal: 'Alimentación', parking: 'Estacionamiento', repair: 'Reparación',
  lodging: 'Hospedaje', other: 'Otro',
};

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canApprove = !!user?.role && APPROVER_ROLES.includes(user.role);

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => ExpensesService.getExpenseById(id),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => ExpensesService.approveExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => Alert.alert('Error', 'No se pudo aprobar el gasto.'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => ExpensesService.rejectExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => Alert.alert('Error', 'No se pudo rechazar el gasto.'),
  });

  const handleApprove = () => {
    if (!expense) return;
    Alert.alert(
      'Aprobar gasto',
      `¿Confirmar aprobación de ${formatCLP(expense.amount)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprobar', onPress: () => approveMutation.mutate() },
      ]
    );
  };

  const handleReject = () => {
    if (!expense) return;
    Alert.alert(
      'Rechazar gasto',
      `¿Rechazar el gasto de ${formatCLP(expense.amount)}? El conductor recibirá una notificación.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Rechazar', style: 'destructive', onPress: () => rejectMutation.mutate() },
      ]
    );
  };

  const mutationLoading = approveMutation.isPending || rejectMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text className="flex-1 text-text-primary font-bold text-lg" style={{ fontFamily: 'Inter_700Bold' }}>
          Detalle del gasto
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      ) : !expense ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-text-muted text-center" style={{ fontFamily: 'Inter_400Regular' }}>
            No se pudo cargar el gasto.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-4 py-5 pb-10" showsVerticalScrollIndicator={false}>
          {/* Category + status */}
          <View className="flex-row items-center mb-6">
            <View className="w-14 h-14 bg-surface-secondary rounded-2xl items-center justify-center mr-4">
              <Text style={{ fontSize: 28 }}>{CATEGORY_ICONS[expense.category] ?? '📋'}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl text-text-primary font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
                {CATEGORY_LABELS[expense.category] ?? expense.category}
              </Text>
              <View className="mt-1">
                <ExpenseStatusBadge status={expense.status} />
              </View>
            </View>
            <Text className="text-2xl text-text-primary font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
              {formatCLP(expense.amount)}
            </Text>
          </View>

          {/* Info rows */}
          <View className="bg-surface-secondary rounded-2xl px-4 py-1 mb-5">
            <Row label="Fecha" value={format(new Date(expense.createdAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })} />
            <Row label="Moneda" value={expense.currency} />
            <Row label="ID" value={`#${expense.id.slice(-8).toUpperCase()}`} last />
          </View>

          {/* Description */}
          {expense.description && (
            <View className="mb-5">
              <Text className="text-sm text-text-secondary mb-2 font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                Descripción
              </Text>
              <View className="bg-surface-secondary rounded-2xl px-4 py-3">
                <Text className="text-text-primary" style={{ fontFamily: 'Inter_400Regular' }}>
                  {expense.description}
                </Text>
              </View>
            </View>
          )}

          {/* Receipt */}
          {expense.receiptUrl && (
            <View className="mb-5">
              <Text className="text-sm text-text-secondary mb-2 font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                Recibo
              </Text>
              <Image
                source={{ uri: expense.receiptUrl }}
                className="w-full h-56 rounded-2xl"
                resizeMode="cover"
              />
            </View>
          )}

          {/* Approve / Reject — only for approvers on pending expenses */}
          {canApprove && expense.status === 'pending' && (
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={handleReject}
                disabled={mutationLoading}
                className="flex-1 py-3 rounded-xl border border-red-500 items-center"
              >
                <Text className="text-red-500 font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Rechazar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApprove}
                disabled={mutationLoading}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: '#22c55e' }}
              >
                {mutationLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    Aprobar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center py-3 ${!last ? 'border-b border-border' : ''}`}>
      <Text className="flex-1 text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
        {label}
      </Text>
      <Text className="text-text-primary text-sm font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
        {value}
      </Text>
    </View>
  );
}
