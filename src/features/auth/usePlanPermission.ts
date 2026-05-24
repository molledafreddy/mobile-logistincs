import { useQuery } from '@tanstack/react-query';
import { AuthService } from '../../services/api/auth.service';
import { useAuthStore } from '../../stores/auth.store';

export function usePlanPermission(code: string): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: () => AuthService.getMyPermissions(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 min — matches Redis TTL on API
    gcTime: 10 * 60 * 1000,
  });

  return data?.permissions.includes(code) ?? false;
}
