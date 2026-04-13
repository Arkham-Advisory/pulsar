import type { ReviewLoadImbalance } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { formatPercent } from '../../lib/utils';
import { Scale } from 'lucide-react';

interface Props {
  imbalance: ReviewLoadImbalance;
  loading?: boolean;
}

export function ReviewLoadBalanceCard({ imbalance, loading }: Props) {
  return (
    <Card>
      <CardHeader
        title="Review Load Imbalance"
        subtitle="How concentrated review work is across the team"
        icon={<Scale className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-14 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
            <p className="text-xs text-slate-400">Top reviewer share</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
              {formatPercent(imbalance.topReviewerShare)}
            </p>
            <p className="text-xs text-slate-400">of completed reviews came from one person</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-400">Most loaded now</p>
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                {imbalance.topPendingReviewer?.login ?? 'None'}
              </p>
              <p className="text-xs text-slate-400">
                {imbalance.topPendingReviewer ? `${imbalance.topPendingReviewer.pending} pending requests` : 'No backlog'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-400">Most active reviewer</p>
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                {imbalance.topCompletedReviewer?.login ?? 'None'}
              </p>
              <p className="text-xs text-slate-400">
                {imbalance.topCompletedReviewer ? `${imbalance.topCompletedReviewer.pending} completed reviews` : 'No reviews yet'}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
