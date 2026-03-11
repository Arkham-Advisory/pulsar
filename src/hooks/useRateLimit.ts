import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../store/settings';
import { fetchRateLimit } from '../services/github';

export function useRateLimit(enabled: boolean) {
  const { pat } = useSettingsStore();

  return useQuery({
    queryKey: ['rate-limit', pat],
    queryFn: () => fetchRateLimit(pat),
    enabled: enabled && !!pat,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: 1000 * 60 * 2, // auto-refresh every 2 min
  });
}
