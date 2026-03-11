import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../store/settings';
import { fetchCIStatuses } from '../services/github';
import type { PullRequest } from '../types/github';

export function useCIStatuses(prs: PullRequest[], enabled: boolean) {
  const { pat } = useSettingsStore();

  const openPRIds = prs
    .filter((p) => p.state === 'open' && !p.draft)
    .slice(0, 100)
    .map((p) => p.id)
    .join(',');

  return useQuery({
    queryKey: ['ci-statuses', pat, openPRIds],
    queryFn: async ({ signal }) => {
      const map = await fetchCIStatuses(pat, prs, signal);
      return map;
    },
    enabled: enabled && !!pat && prs.length > 0,
    staleTime: 1000 * 60 * 3, // 3 minutes — CI changes frequently
    gcTime: 1000 * 60 * 30,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
