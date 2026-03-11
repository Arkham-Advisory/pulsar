import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../store/settings';
import { fetchApprovalStatuses } from '../services/github';
import type { PullRequest } from '../types/github';

export function useApprovalStatuses(prs: PullRequest[], enabled: boolean) {
  const { pat } = useSettingsStore();

  const openPRIds = prs
    .filter((p) => p.state === 'open' && !p.draft)
    .slice(0, 100)
    .map((p) => p.id)
    .join(',');

  return useQuery({
    queryKey: ['approval-statuses', pat, openPRIds],
    queryFn: async ({ signal }) => fetchApprovalStatuses(pat, prs, signal),
    enabled: enabled && !!pat && prs.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
