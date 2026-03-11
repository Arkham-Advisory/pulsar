import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../store/settings';
import { fetchAllData } from '../services/github';
import { getSinceDate } from '../lib/metrics';
import { useState } from 'react';

export function useGitHubData() {
  const { pat, repoFilters, timeRange, hasValidSettings } = useSettingsStore();
  const [progress, setProgress] = useState<string>('');

  const since = getSinceDate(timeRange);

  const query = useQuery({
    queryKey: ['github-data', pat, JSON.stringify(repoFilters), timeRange],
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
    enabled: hasValidSettings(),
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 60,    // 1 hour
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return { ...query, progress };
}
