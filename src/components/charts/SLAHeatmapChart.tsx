import type { SLAHeatmapRow } from '../../types/github';
import type { SLAPolicy } from '../../types/settings';
import { Card, CardHeader } from '../ui/Card';
import { formatDuration } from '../../lib/metrics';
import { Target } from 'lucide-react';

interface Props {
  data: SLAHeatmapRow[];
  slaPolicy: SLAPolicy;
  loading?: boolean;
}

function cellClass(hours: number | null, target: number): string {
  if (hours === null) return 'text-slate-400 dark:text-slate-600';
  if (hours <= target * 0.75)
    return 'font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded px-1.5';
  if (hours <= target)
    return 'font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-1.5';
  return 'font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-1.5';
}

export function SLAHeatmapChart({ data, slaPolicy, loading }: Props) {
  return (
    <Card className="col-span-2">
      <CardHeader
        title="SLA Heatmap"
        subtitle={`Targets: review ≤${slaPolicy.firstReviewHours}h · approval ≤${slaPolicy.approvalHours}h · merge ≤${slaPolicy.mergeHours}h`}
        icon={<Target className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 skeleton rounded-lg" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
          No merged PR data yet
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">#</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Author</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">PRs</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Open→Review
                  <span className="ml-1 font-normal opacity-60">≤{slaPolicy.firstReviewHours}h</span>
                </th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Review→Approve
                  <span className="ml-1 font-normal opacity-60">≤{slaPolicy.approvalHours}h</span>
                </th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Approve→Merge
                  <span className="ml-1 font-normal opacity-60">≤{slaPolicy.mergeHours}h</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.login}
                  className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-5 py-2.5 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-5 py-2.5">
                    <a
                      href={`https://github.com/${row.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 group"
                    >
                      <img src={row.avatar_url} alt={row.login} className="w-6 h-6 rounded-full" />
                      <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {row.login}
                      </span>
                    </a>
                  </td>
                  <td className="px-5 py-2.5 text-right text-xs text-slate-500">{row.prCount}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`text-xs font-mono ${cellClass(row.openToFirstReview, slaPolicy.firstReviewHours)}`}>
                      {formatDuration(row.openToFirstReview)}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`text-xs font-mono ${cellClass(row.firstReviewToApproval, slaPolicy.approvalHours)}`}>
                      {formatDuration(row.firstReviewToApproval)}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`text-xs font-mono ${cellClass(row.approvalToMerge, slaPolicy.mergeHours)}`}>
                      {formatDuration(row.approvalToMerge)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Legend */}
          <div className="px-5 py-3 flex items-center gap-4 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Within SLA
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Approaching
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Over SLA
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
