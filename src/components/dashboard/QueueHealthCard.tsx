import type { QueueHealth } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { formatDuration } from '../../lib/metrics';
import { Eye } from 'lucide-react';

interface Props {
  queueHealth: QueueHealth;
  loading?: boolean;
}

export function QueueHealthCard({ queueHealth, loading }: Props) {
  return (
    <Card>
      <CardHeader
        title="Queue Health"
        subtitle="How heavy the review queue feels right now"
        icon={<Eye className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
              <p className="text-xs text-slate-400">Waiting</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{queueHealth.waitingCount}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
              <p className="text-xs text-slate-400">Oldest wait</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{formatDuration(queueHealth.oldestHours)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
              <p className="text-xs text-slate-400">Median wait</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{formatDuration(queueHealth.medianHours)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Reviewer pressure</p>
            {queueHealth.overloadedReviewers.length === 0 ? (
              <p className="text-sm text-slate-400">No reviewer hotspots.</p>
            ) : (
              queueHealth.overloadedReviewers.map((reviewer) => (
                <div key={reviewer.login} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    {reviewer.avatar_url ? (
                      <img src={reviewer.avatar_url} alt={reviewer.login} className="h-6 w-6 rounded-full" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700" />
                    )}
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{reviewer.login}</span>
                  </div>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{reviewer.pending} pending</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
