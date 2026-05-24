import { View, Text } from 'react-native';
import type { RunStatus, StopStatus, ExpenseStatus } from '../../types';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  danger: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  info: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  neutral: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

export function Badge({ children, variant = 'neutral', dot = false }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <View className={`flex-row items-center self-start rounded-full px-2.5 py-1 ${styles.bg}`}>
      {dot && <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${styles.dot}`} />}
      <Text className={`text-xs font-medium ${styles.text}`} style={{ fontFamily: 'Inter_500Medium' }}>
        {children}
      </Text>
    </View>
  );
}

// Helpers: status → badge variant
export function RunStatusBadge({ status }: { status: RunStatus }) {
  const map: Record<RunStatus, { label: string; variant: BadgeVariant }> = {
    planned:    { label: 'Planificado', variant: 'info' },
    ready:      { label: 'Listo',       variant: 'warning' },
    in_progress: { label: 'En curso',  variant: 'success' },
    completed:  { label: 'Completado', variant: 'neutral' },
    cancelled:  { label: 'Cancelado',  variant: 'danger' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'neutral' };
  return <Badge variant={variant} dot>{label}</Badge>;
}

export function StopStatusBadge({ status }: { status: StopStatus }) {
  const map: Record<StopStatus, { label: string; variant: BadgeVariant }> = {
    pending:    { label: 'Pendiente',  variant: 'warning' },
    in_transit: { label: 'En camino', variant: 'info' },
    arrived:    { label: 'Llegó',     variant: 'neutral' },
    delivered:  { label: 'Entregado', variant: 'success' },
    failed:     { label: 'Fallido',   variant: 'danger' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'neutral' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const map: Record<ExpenseStatus, { label: string; variant: BadgeVariant }> = {
    pending: { label: 'Pendiente', variant: 'warning' },
    approved: { label: 'Aprobado', variant: 'success' },
    rejected: { label: 'Rechazado', variant: 'danger' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'neutral' };
  return <Badge variant={variant}>{label}</Badge>;
}
