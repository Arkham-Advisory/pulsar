import type { TrendSummary } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { formatDuration } from '../../lib/metrics';
import { ArrowUpRight, ArrowDownRight, Minus, Sparkles } from 'lucide-react';

interface Props {
  summary: TrendSummary;
  loading?: boolean;
}

function DeltaRow({
  label,
  value,
  previous,
  trend,
  formatter,
}: {
  label: string;
  value: number | null;
  previous: number | null;
  trend: 'up' | 'down' | 'neutral';
  formatter: (value: number | null) => string;
}) {
  const icon = trend === 'up'
    ? <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
    : trend === 'down'
      ? <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
      : <Minus className="h-3.5 w-3.5 text-slate-400" />;

  const tone = trend === 'up'
    ? 'text-green-600 dark:text-green-400'
    : trend === 'down'
      ? 'text-red-600 dark:text-red-400'
      : 'text-slate-500 dark:text-slate-400';

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatter(value)}</p>
        </div>
        <div className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
          {icon}
          <span>Prev {formatter(previous)}</span>
        </div>
      </div>
    </div>
  );
}

export function TrendSummaryCard({ summary, loading }: Props) {
  return (
    <Card>
      <CardHeader
        title="Trend Delta Summary"
        subtitle="Current window vs previous comparable period"
        icon={<Sparkles className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <DeltaRow
            label="Merged PRs"
            value={summary.merged.current}
            previous={summary.merged.previous}
            trend={summary.merged.trend}
            formatter={(value) => (value ?? 0).toString()}
          />
          <DeltaRow
            label="Cycle time"
            value={summary.cycleTime.current}
            previous={summary.cycleTime.previous}
            trend={summary.cycleTime.trend}
            formatter={formatDuration}
          />
          <DeltaRow
            label="Time to first review"
            value={summary.timeToFirstReview.current}
            previous={summary.timeToFirstReview.previous}
            trend={summary.timeToFirstReview.trend}
            formatter={formatDuration}
          />
        </div>
      )}
    </Card>
  );
}
