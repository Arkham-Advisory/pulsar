import { useMemo } from 'react';
import type { PullRequest, PRReview } from '../../types/github';
import { useSettingsStore } from '../../store/settings';
import { getSinceDate, computeMetrics, buildWeeklyData, buildCycleTimeData, buildAuthorStats, buildReviewerStats, buildSizeDistribution, formatDuration } from '../../lib/metrics';
import { MetricCard } from './MetricCard';
import { StalePRsCard } from './StalePRsCard';
import { WaitingReviewCard } from './WaitingReviewCard';
import { RecentlyMergedCard } from './RecentlyMergedCard';
import { PRVelocityChart } from '../charts/PRVelocityChart';
import { CycleTimeChart } from '../charts/CycleTimeChart';
import { ReviewWorkloadChart } from '../charts/ReviewWorkloadChart';
import { PRSizeChart } from '../charts/PRSizeChart';
import { AuthorActivityTable } from '../charts/AuthorActivityTable';
import {
  GitPullRequest,
  GitMerge,
  Clock,
  Eye,
  AlertTriangle,
  GitBranch,
} from 'lucide-react';
import { formatPercent, formatNumber } from '../../lib/utils';

interface Props {
  prs: PullRequest[];
  reviews: PRReview[];
  loading: boolean;
}

export function Dashboard({ prs, reviews, loading }: Props) {
  const { timeRange, staleDaysThreshold } = useSettingsStore();
  const since = useMemo(() => getSinceDate(timeRange), [timeRange]);

  const metrics = useMemo(
    () => (prs.length > 0 ? computeMetrics(prs, reviews, staleDaysThreshold) : null),
    [prs, reviews, staleDaysThreshold]
  );

  const weeklyData = useMemo(() => buildWeeklyData(prs, since), [prs, since]);
  const cycleTimeData = useMemo(() => buildCycleTimeData(prs, since), [prs, since]);
  const authorStats = useMemo(() => buildAuthorStats(prs, reviews), [prs, reviews]);
  const reviewerStats = useMemo(() => buildReviewerStats(prs, reviews), [prs, reviews]);
  const sizeDistribution = useMemo(() => buildSizeDistribution(prs), [prs]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-5 space-y-5 max-w-[1800px] mx-auto">

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <MetricCard
            label="Open PRs"
            value={loading ? '…' : formatNumber(metrics?.open ?? 0)}
            subValue={`${metrics?.draft ?? 0} drafts`}
            icon={<GitPullRequest className="h-4 w-4" />}
            iconColor="text-brand-600 dark:text-brand-400"
            loading={loading}
          />
          <MetricCard
            label="Merged"
            value={loading ? '…' : formatNumber(metrics?.merged ?? 0)}
            subValue={`${formatPercent(metrics?.mergeRate ?? 0)} merge rate`}
            icon={<GitMerge className="h-4 w-4" />}
            iconColor="text-green-600 dark:text-green-400"
            loading={loading}
          />
          <MetricCard
            label="Avg Cycle Time"
            value={loading ? '…' : formatDuration(metrics?.avgCycleTimeHours ?? null)}
            subValue="open → merged"
            icon={<Clock className="h-4 w-4" />}
            iconColor="text-purple-600 dark:text-purple-400"
            loading={loading}
          />
          <MetricCard
            label="Time to 1st Review"
            value={loading ? '…' : formatDuration(metrics?.avgTimeToFirstReviewHours ?? null)}
            subValue="open → first review"
            icon={<Eye className="h-4 w-4" />}
            iconColor="text-blue-600 dark:text-blue-400"
            loading={loading}
          />
          <MetricCard
            label="Stale PRs"
            value={loading ? '…' : formatNumber(metrics?.stale ?? 0)}
            subValue={`> ${staleDaysThreshold} days inactive`}
            icon={<AlertTriangle className="h-4 w-4" />}
            iconColor={metrics && metrics.stale > 0 ? 'text-red-500' : 'text-slate-400'}
            alert={!loading && (metrics?.stale ?? 0) > 0}
            loading={loading}
          />
          <MetricCard
            label="Awaiting Review"
            value={loading ? '…' : formatNumber(metrics?.waitingReview ?? 0)}
            subValue="review requested"
            icon={<GitBranch className="h-4 w-4" />}
            iconColor={metrics && metrics.waitingReview > 3 ? 'text-amber-500' : 'text-slate-400'}
            alert={!loading && (metrics?.waitingReview ?? 0) > 5}
            loading={loading}
          />
        </div>

        {/* Charts Row 1: Velocity + Cycle Time */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PRVelocityChart data={weeklyData} loading={loading} />
          <CycleTimeChart data={cycleTimeData} loading={loading} />
        </div>

        {/* Charts Row 2: Review Workload + Size Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReviewWorkloadChart data={reviewerStats} loading={loading} />
          <PRSizeChart data={sizeDistribution} loading={loading} />
        </div>

        {/* Action Cards Row: Stale + Waiting + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StalePRsCard prs={prs} staleDays={staleDaysThreshold} loading={loading} />
          <WaitingReviewCard prs={prs} loading={loading} />
          <RecentlyMergedCard prs={prs} loading={loading} />
        </div>

        {/* Author Activity Table */}
        <div className="grid grid-cols-1 gap-4">
          <AuthorActivityTable data={authorStats} loading={loading} />
        </div>

        {/* Footer */}
        <div className="pb-4 text-center text-xs text-slate-400">
          Showing data from the last {timeRange.replace('d', ' days')} •{' '}
          {loading ? 'Loading...' : `${prs.length} PRs analyzed`}
        </div>
      </div>
    </div>
  );
}
