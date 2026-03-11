import { useDashboardData } from '../hooks/useDashboardData';
import { Dashboard } from '../components/dashboard/Dashboard';
import { Spinner } from '../components/ui/Spinner';
import { BarChart3 } from 'lucide-react';

interface Props {
  onRefreshFinished?: () => void;
}

export function DashboardPage({ onRefreshFinished: _ }: Props) {
  const { data, isLoading, isFetching, progress } = useDashboardData(true);

  const prs = data?.prs ?? [];
  const reviews = data?.reviews ?? [];

  return (
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

      {(!isLoading || prs.length > 0) && (
        <Dashboard prs={prs} reviews={reviews} loading={isLoading && prs.length === 0} />
      )}
    </div>
  );
}
