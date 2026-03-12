import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../store/settings';
import { fetchPRBatchDetails } from '../services/github';
import type { PullRequest } from '../types/github';

// Returns both conflict flags (Map<PR id, true> where GitHub reports mergeable===false)
// and size totals (Map<PR id, additions+deletions>) — both come from the same pulls.get batch.
export function usePRDetails(prs: PullRequest[], enabled: boolean) {
  const { pat } = useSettingsStore();

  const openPRIds = prs
    .filter((p) => p.state === 'open' && !p.draft)
    .slice(0, 100)
    .map((p) => p.id)
    .join(',');

  return useQuery({
    queryKey: ['pr-details', pat, openPRIds],
    queryFn: async ({ signal }) => fetchPRBatchDetails(pat, prs, signal),
    enabled: enabled && !!pat && prs.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// Backwards-compat alias
export const useConflictStatuses = usePRDetails;

