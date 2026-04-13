import type { HandoffFrictionRow } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { formatDuration } from '../../lib/metrics';
import { MoveRight } from 'lucide-react';

interface Props {
  rows: HandoffFrictionRow[];
  loading?: boolean;
}

export function HandoffFrictionCard({ rows, loading }: Props) {
  return (
    <Card>
      <CardHeader
        title="Handoff Friction"
        subtitle="Where work slows down after review has already started"
        icon={<MoveRight className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          No handoff friction detected
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.login} className="rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={row.avatar_url} alt={row.login} className="h-6 w-6 rounded-full" />
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{row.login}</p>
                </div>
                <span className="text-xs text-slate-400">{row.prCount} PRs</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/20">
                  <p className="text-xs text-amber-700 dark:text-amber-300">Review → approval</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatDuration(row.reviewToApprovalHours)}
                  </p>
                </div>
                <div className="rounded-xl bg-rose-50 px-3 py-2 dark:bg-rose-950/20">
                  <p className="text-xs text-rose-700 dark:text-rose-300">Approval → merge</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatDuration(row.approvalToMergeHours)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
