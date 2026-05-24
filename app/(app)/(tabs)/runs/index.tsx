import { useState, useMemo } from 'react';
import { FlatList, View, Text, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DeliveryRunsService } from '../../../../src/services/api/delivery-runs.service';
import { RecurringTemplatesService } from '../../../../src/services/api/recurring-templates.service';
import { RunStatusBadge } from '../../../../src/components/ui/Badge';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DeliveryRun } from '../../../../src/types';

type FilterValue = 'all' | 'in_progress' | 'scheduled' | 'completed';

const FILTERS: { label: string; value: FilterValue; icon: string }[] = [
  { label: 'Todos',       value: 'all',        icon: 'list' },
  { label: 'En curso',    value: 'in_progress', icon: 'play-circle' },
  { label: 'Programados', value: 'scheduled',   icon: 'calendar' },
  { label: 'Completados', value: 'completed',   icon: 'checkmark-circle' },
];

function RunCardSkeleton() {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Skeleton width="40%" height={16} />
        <Skeleton width={80} height={22} borderRadius={12} />
      </View>
      <Skeleton width="60%" height={12} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Skeleton width={80} height={12} />
        <Skeleton width={80} height={12} />
      </View>
    </View>
  );
}

function RunCard({ run }: { run: DeliveryRun }) {
  const isInProgress = run.status === 'in_progress';
  const progress = run.totalStops > 0 ? run.completedStops / run.totalStops : 0;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/delivery/${run.id}`)}
      activeOpacity={0.7}
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        borderWidth: isInProgress ? 1.5 : 0,
        borderColor: isInProgress ? '#22c55e' : 'transparent',
      }}
    >
      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#0f172a' }}>
            Run #{run.id.slice(-6).toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginLeft: 4 }}>
              {format(new Date(run.scheduledDate), "EEE d MMM · HH:mm", { locale: es })}
            </Text>
          </View>
        </View>
        <RunStatusBadge status={run.status} />
      </View>

      {/* Progress bar for in-progress runs */}
      {isInProgress && (
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: '#22c55e' }}>
              Progreso
            </Text>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#22c55e' }}>
              {run.completedStops}/{run.totalStops} paradas
            </Text>
          </View>
          <View style={{ height: 5, backgroundColor: '#dcfce7', borderRadius: 3 }}>
            <View style={{ height: 5, backgroundColor: '#22c55e', borderRadius: 3, width: `${progress * 100}%` }} />
          </View>
        </View>
      )}

      {/* Bottom row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="location-outline" size={13} color="#64748b" />
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#64748b', marginLeft: 3 }}>
            {run.totalStops} {run.totalStops === 1 ? 'parada' : 'paradas'}
          </Text>
        </View>
        {run.truckPlate && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="bus-outline" size={13} color="#64748b" />
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#64748b', marginLeft: 3 }}>
              {run.truckPlate}
            </Text>
          </View>
        )}
        {!isInProgress && (
          <View style={{ marginLeft: 'auto' }}>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyRuns({ filter }: { filter: string }) {
  const messages: Record<string, { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }> = {
    all: { icon: 'cube-outline', title: 'Sin runs asignados', desc: 'Cuando te asignen un run aparecerá aquí.' },
    in_progress: { icon: 'play-circle-outline', title: 'Ningún run en curso', desc: 'No tienes runs activos en este momento.' },
    scheduled: { icon: 'calendar-outline', title: 'Sin runs programados', desc: 'No hay runs pendientes de iniciar.' },
    completed: { icon: 'checkmark-circle-outline', title: 'Sin runs completados', desc: 'Aún no has completado ningún run.' },
  };
  const { icon, title, desc } = messages[filter] ?? messages['all'];
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Ionicons name={icon} size={36} color="#94a3b8" />
      </View>
      <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#334155', marginBottom: 6 }}>{title}</Text>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8', textAlign: 'center', paddingHorizontal: 32 }}>{desc}</Text>
    </View>
  );
}

export default function RunsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['delivery-runs', 'list'],
    queryFn: () => DeliveryRunsService.getMyRuns({ limit: 50 }),
  });

  const { data: templatesData } = useQuery({
    queryKey: ['recurring-templates', 'count'],
    queryFn: () => RecurringTemplatesService.getAll({ active: true, limit: 1 }),
    staleTime: 5 * 60_000,
  });
  const activeTemplateCount = templatesData?.total ?? 0;

  const allRuns = data?.data ?? [];

  const runs = useMemo(() => {
    switch (activeFilter) {
      case 'in_progress': return allRuns.filter((r) => r.status === 'in_progress');
      case 'scheduled':   return allRuns.filter((r) => r.status === 'planned' || r.status === 'ready');
      case 'completed':   return allRuns.filter((r) => r.status === 'completed');
      default:            return allRuns;
    }
  }, [allRuns, activeFilter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: '#0f172a' }}>Mis Runs</Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 2 }}>
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(app)/runs/new' as any)}
          style={{ width: 40, height: 40, backgroundColor: '#22c55e', borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#22c55e', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Templates banner */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/templates' as any)}
        activeOpacity={0.8}
        style={{ marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}
      >
        <Ionicons name="copy-outline" size={18} color="#16a34a" />
        <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#15803d' }}>
          {activeTemplateCount > 0
            ? `${activeTemplateCount} plantilla${activeTemplateCount !== 1 ? 's' : ''} activa${activeTemplateCount !== 1 ? 's' : ''} — generar run en 1 tap`
            : 'Plantillas — reutiliza rutas recurrentes'}
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#16a34a" />
      </TouchableOpacity>

      {/* Filters — ScrollView with flexShrink:0 prevents vertical stretching */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.value;
          return (
            <TouchableOpacity
              key={filter.value}
              onPress={() => setActiveFilter(filter.value)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: isActive ? '#22c55e' : '#fff',
                borderWidth: 1,
                borderColor: isActive ? '#22c55e' : '#e2e8f0',
                gap: 5,
              }}
            >
              <Ionicons
                name={`${filter.icon}-outline` as any}
                size={13}
                color={isActive ? '#fff' : '#64748b'}
              />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: isActive ? '#fff' : '#475569' }}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          {[1, 2, 3].map((i) => <RunCardSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" />
          }
          renderItem={({ item }) => <RunCard run={item} />}
          ListEmptyComponent={<EmptyRuns filter={activeFilter} />}
        />
      )}
    </SafeAreaView>
  );
}
