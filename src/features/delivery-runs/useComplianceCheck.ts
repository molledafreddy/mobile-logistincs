import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';
import { VerificationsService } from '../../services/api/verifications.service';
import type { ComplianceStatus } from '../../types';

interface ComplianceCheckResult {
  compliance: ComplianceStatus | undefined;
  isLoading: boolean;
  canOperate: boolean;
  blockMessage: string | null;
}

const BLOCK_MESSAGES: Record<string, string> = {
  no_verification: 'Tu empresa no tiene una verificación activa para operar servicios de pasajeros.',
  tier_not_approved: 'La verificación "Passenger Safe" no ha sido aprobada aún.',
  tier_expired: 'La verificación para operar con pasajeros ha expirado. Renuévala para continuar.',
};

export function useComplianceCheck(enabled = true): ComplianceCheckResult {
  const user = useAuthStore((s) => s.user);

  // serviceType lives on Company, not AuthUser — fetched separately when needed.
  // For now the guard activates for any user with a companyId.
  const hasCompany = !!user?.companyId;

  const { data: compliance, isLoading } = useQuery({
    queryKey: ['compliance', user?.companyId],
    queryFn: () => VerificationsService.getCompliance(user!.companyId!),
    enabled: enabled && hasCompany,
    staleTime: 5 * 60_000,
  });

  const isPassenger = compliance?.serviceType === 'passenger' || compliance?.serviceType === 'mixed';

  if (!isPassenger && !isLoading) {
    return { compliance, isLoading: false, canOperate: true, blockMessage: null };
  }

  const canOperate = compliance?.canOperate ?? false;
  const blockReason = compliance?.blockReason;
  const blockMessage = blockReason ? (BLOCK_MESSAGES[blockReason] ?? 'No puedes operar en este momento.') : null;

  return { compliance, isLoading, canOperate, blockMessage };
}
