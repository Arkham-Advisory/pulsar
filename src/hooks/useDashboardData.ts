import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSettingsStore } from '../store/settings';
import { fetchAllData } from '../services/github';
import { getSinceDate } from '../lib/metrics';

// Fetches full enriched data (size + reviews) — used by the dashboard page.
// Only activates when `enabled` is true (i.e., when the user navigates to the
// dashboard) so the PR list page doesn't pay the cost upfront.
export function useDashboardData(enabled: boolean) {
  const { pat, repoFilters, timeRange, hasValidSettings } = useSettingsStore();
  const [progress, setProgress] = useState('');

  const since = getSinceDate(timeRange);

  const query = useQuery({
    queryKey: ['dashboard-data', pat, JSON.stringify(repoFilters), timeRange],
    queryFn: async ({ signal }) => {
      const result = await fetchAllData(
        pat,
        repoFilters,
        since,
        (msg) => setProgress(msg),
        signal
      );
      setProgress('');
      return result;
    },
    enabled: enabled && hasValidSettings(),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { ...query, progress };
}
