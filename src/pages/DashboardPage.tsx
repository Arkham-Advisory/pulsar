import { useDashboardData } from '../hooks/useDashboardData';
import { Dashboard } from '../components/dashboard/Dashboard';
import { Spinner } from '../components/ui/Spinner';
import { QueryError } from '../components/ui/QueryError';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { BarChart3 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  onRefreshFinished?: () => void;
}

export function DashboardPage({ onRefreshFinished: _ }: Props) {
  const { data, isLoading, isError, isFetching, progress } = useDashboardData(true);
  const qc = useQueryClient();

  const prs = data?.prs ?? [];
  const reviews = data?.reviews ?? [];

  if (isError && prs.length === 0) {
    return (
      <ErrorBoundary>
        <QueryError
          message="Could not load dashboard data. Check your network connection or PAT permissions."
          onRetry={() => qc.invalidateQueries({ queryKey: ['dashboard-data'] })}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Loading overlay only on first load */}
        {isLoading && prs.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="p-4 bg-brand-50 dark:bg-brand-950/30 rounded-2xl">
              <BarChart3 className="h-10 w-10 text-brand-500" />
            </div>
            <Spinner size="lg" />
            {progress && <p className="text-sm text-slate-400 max-w-xs text-center">{progress}</p>}
            <p className="text-xs text-slate-400">Fetching PR details and reviews…</p>
          </div>
        )}

        {/* In-background refresh banner */}
        {isFetching && prs.length > 0 && progress && (
          <div className="shrink-0 flex items-center gap-2 px-5 py-2 bg-brand-50 dark:bg-brand-950/20 border-b border-brand-100 dark:border-brand-900/30 text-xs text-brand-700 dark:text-brand-400">
            <Spinner size="sm" className="h-3 w-3" />
            <span>{progress}</span>
          </div>
        )}

        {/* Background refresh error banner */}
        {isError && prs.length > 0 && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/30 text-xs text-red-600 dark:text-red-400">
            <span>Failed to refresh — showing cached data.</span>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['dashboard-data'] })}
              className="underline underline-offset-2 hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {(!isLoading || prs.length > 0) && (
          <Dashboard prs={prs} reviews={reviews} loading={isLoading && prs.length === 0} />
        )}
      </div>
    </ErrorBoundary>
  );
}
