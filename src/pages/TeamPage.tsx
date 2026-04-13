import { useDashboardData } from '../hooks/useDashboardData';
import { TeamDashboard } from '../components/dashboard/TeamDashboard';
import { Spinner } from '../components/ui/Spinner';
import { QueryError } from '../components/ui/QueryError';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { UsersRound } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function TeamPage() {
  const { data, isLoading, isError, isFetching, progress } = useDashboardData(true);
  const qc = useQueryClient();

  const prs = data?.prs ?? [];
  const reviews = data?.reviews ?? [];

  if (isError && prs.length === 0) {
    return (
      <ErrorBoundary>
        <QueryError
          message="Could not load team metrics. Check your network connection or PAT permissions."
          onRetry={() => qc.invalidateQueries({ queryKey: ['dashboard-data'] })}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoading && prs.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="rounded-2xl bg-brand-50 p-4 dark:bg-brand-950/30">
              <UsersRound className="h-10 w-10 text-brand-500" />
            </div>
            <Spinner size="lg" />
            {progress && <p className="max-w-xs text-center text-sm text-slate-400">{progress}</p>}
            <p className="text-xs text-slate-400">Loading collaboration metrics…</p>
          </div>
        )}

        {isFetching && prs.length > 0 && progress && (
          <div className="shrink-0 flex items-center gap-2 border-b border-brand-100 bg-brand-50 px-5 py-2 text-xs text-brand-700 dark:border-brand-900/30 dark:bg-brand-950/20 dark:text-brand-400">
            <Spinner size="sm" className="h-3 w-3" />
            <span>{progress}</span>
          </div>
        )}

        {isError && prs.length > 0 && (
          <div className="shrink-0 flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-5 py-2 text-xs text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
            <span>Failed to refresh — showing cached team data.</span>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['dashboard-data'] })}
              className="underline underline-offset-2 hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {(!isLoading || prs.length > 0) && (
          <TeamDashboard prs={prs} reviews={reviews} loading={isLoading && prs.length === 0} />
        )}
      </div>
    </ErrorBoundary>
  );
}
