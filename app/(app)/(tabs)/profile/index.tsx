import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../../src/stores/auth.store';
import { CompaniesService } from '../../../../src/services/api/companies.service';
import { TrucksService } from '../../../../src/services/api/trucks.service';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';

const SERVICE_TYPE_LABEL: Record<string, string> = {
  freight:   'Carga',
  passenger: 'Pasajeros',
  mixed:     'Mixto',
};

const ROLE_LABEL: Record<string, string> = {
  company_owner: 'Propietario',
  admin:         'Administrador',
  manager:       'Gerente',
  dispatcher:    'Dispatcher',
  driver:        'Conductor',
  accountant:    'Contador',
  viewer:        'Solo lectura',
  super_admin:   'Super Admin',
};

function ProfileRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-row items-center py-3 border-b border-border last:border-0">
      <Text className="text-xl mr-3">{icon}</Text>
      <View className="flex-1">
        <Text className="text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>{label}</Text>
        <Text className="text-text-primary text-sm" style={{ fontFamily: 'Inter_500Medium' }}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const driverId = useAuthStore((s) => s.driverId);
  const logout = useAuthStore((s) => s.logout);

  const { data: company } = useQuery({
    queryKey: ['companies', user?.companyId],
    queryFn: () => CompaniesService.getById(user!.companyId!),
    enabled: !!user?.companyId,
    staleTime: 5 * 60_000,
  });

  const { data: truck } = useQuery({
    queryKey: ['my-truck', driverId ?? user?.id],
    queryFn: () => TrucksService.getAll({ ...(driverId ? { driverId } : {}), limit: 1 }),
    enabled: !!user?.id,
    staleTime: 2 * 60_000,
    select: (res) => res.data[0] ?? null,
  });

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: logout },
      ]
    );
  };

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        {/* Header */}
        <View className="items-center pt-8 pb-6">
          <View className="w-20 h-20 bg-primary-500 rounded-full items-center justify-center mb-3">
            <Text className="text-white text-2xl font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
              {user.firstName[0]}{user.lastName[0]}
            </Text>
          </View>
          <Text className="text-text-primary text-xl" style={{ fontFamily: 'Inter_700Bold' }}>
            {user.firstName} {user.lastName}
          </Text>
          <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
            {user.email}
          </Text>
        </View>

        {/* Info */}
        <Card className="mb-4">
          <ProfileRow
            icon="🏢"
            label="Empresa"
            value={company?.name ?? '—'}
          />
          <ProfileRow
            icon="🎭"
            label="Rol"
            value={ROLE_LABEL[user.role] ?? user.role}
          />
          <ProfileRow
            icon="🚛"
            label="Tipo de servicio"
            value={company ? (SERVICE_TYPE_LABEL[company.serviceType] ?? company.serviceType) : '—'}
          />
        </Card>

        {/* Quick links — visible for all roles */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/my-truck' as any)}
          className="flex-row items-center bg-white rounded-2xl border border-border px-4 py-3.5 mb-3"
          activeOpacity={0.75}
        >
          <Text className="text-xl mr-3">🚛</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
              Mi vehículo
            </Text>
            <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              {truck ? truck.plate : 'Registrar o editar datos del camión'}
            </Text>
          </View>
          <Text className="text-text-muted">›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(app)/saved-addresses' as any)}
          className="flex-row items-center bg-white rounded-2xl border border-border px-4 py-3.5 mb-4"
          activeOpacity={0.75}
        >
          <Text className="text-xl mr-3">📍</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
              Direcciones guardadas
            </Text>
            <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              Favoritos de la empresa
            </Text>
          </View>
          <Text className="text-text-muted">›</Text>
        </TouchableOpacity>

        {/* Verification — company_owner only */}
        {user.role === 'company_owner' && (
          <TouchableOpacity
            onPress={() => router.push('/(app)/verification' as any)}
            className="flex-row items-center bg-white rounded-2xl border border-border px-4 py-3.5 mb-3"
            activeOpacity={0.75}
          >
            <Text className="text-xl mr-3">📋</Text>
            <View className="flex-1">
              <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                Verificación de empresa
              </Text>
              <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                Sube los documentos requeridos
              </Text>
            </View>
            <Text className="text-text-muted">›</Text>
          </TouchableOpacity>
        )}

        {/* Billing — company_owner, admin, manager */}
        {(user.role === 'company_owner' || user.role === 'admin' || user.role === 'manager') && (
          <TouchableOpacity
            onPress={() => router.push('/(app)/billing' as any)}
            className="flex-row items-center bg-white rounded-2xl border border-border px-4 py-3.5 mb-3"
            activeOpacity={0.75}
          >
            <Text className="text-xl mr-3">💳</Text>
            <View className="flex-1">
              <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                Suscripción y pagos
              </Text>
              <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                Plan activo, renovación y cobros
              </Text>
            </View>
            <Text className="text-text-muted">›</Text>
          </TouchableOpacity>
        )}

        {/* Plans catalog — visible for all */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/plans' as any)}
          className="flex-row items-center bg-white rounded-2xl border border-border px-4 py-3.5 mb-3"
          activeOpacity={0.75}
        >
          <Text className="text-xl mr-3">📦</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
              Planes
            </Text>
            <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              Ver planes disponibles y sus límites
            </Text>
          </View>
          <Text className="text-text-muted">›</Text>
        </TouchableOpacity>

        {/* Fleet management — company_owner, admin, manager */}
        {(user.role === 'company_owner' || user.role === 'admin' || user.role === 'manager') && (
          <TouchableOpacity
            onPress={() => router.push('/(app)/fleet' as any)}
            className="flex-row items-center bg-white rounded-2xl border border-border px-4 py-3.5 mb-3"
            activeOpacity={0.75}
          >
            <Text className="text-xl mr-3">🚛</Text>
            <View className="flex-1">
              <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                Gestión de flota
              </Text>
              <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                Conductores y vehículos de tu empresa
              </Text>
            </View>
            <Text className="text-text-muted">›</Text>
          </TouchableOpacity>
        )}

        {/* Metrics */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/metrics' as any)}
          className="flex-row items-center bg-white rounded-2xl border border-border px-4 py-3.5 mb-3"
          activeOpacity={0.75}
        >
          <Text className="text-xl mr-3">📊</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
              Mis métricas
            </Text>
            <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              Desempeño y gastos del mes
            </Text>
          </View>
          <Text className="text-text-muted">›</Text>
        </TouchableOpacity>

        {/* Security */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/change-password' as any)}
          className="flex-row items-center bg-white rounded-2xl border border-border px-4 py-3.5 mb-4"
          activeOpacity={0.75}
        >
          <Text className="text-xl mr-3">🔒</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
              Cambiar contraseña
            </Text>
            <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              Actualiza tu contraseña de acceso
            </Text>
          </View>
          <Text className="text-text-muted">›</Text>
        </TouchableOpacity>

        {/* Actions */}
        <Button variant="danger" fullWidth onPress={handleLogout}>
          Cerrar sesión
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
