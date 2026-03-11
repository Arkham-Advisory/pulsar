import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSettingsStore } from '../store/settings';
import { fetchBasicPRData } from '../services/github';
import { getSinceDate } from '../lib/metrics';

export function usePRListData() {
  const { pat, repoFilters, timeRange, hasValidSettings } = useSettingsStore();
  const [progress, setProgress] = useState('');

  const since = getSinceDate(timeRange);

  const query = useQuery({
    queryKey: ['pr-list', pat, JSON.stringify(repoFilters), timeRange],
    queryFn: async ({ signal }) => {
      const prs = await fetchBasicPRData(
        pat,
        repoFilters,
        since,
        (msg) => setProgress(msg),
        signal
      );
      setProgress('');
      return prs;
    },
    enabled: hasValidSettings(),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { ...query, progress };
}
