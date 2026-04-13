import { useMemo } from 'react';
import type { PullRequest, PRReview } from '../../types/github';
import { useSettingsStore } from '../../store/settings';
import {
  getSinceDate,
  computeMetrics,
  buildWeeklyData,
  buildCycleTimeData,
  buildWeeklyDigest,
  formatDuration,
  buildTrendSummary,
  buildHotspotQueue,
  buildRiskBuckets,
  buildQueueHealth,
  buildPRAgingBuckets,
  buildMergeReadinessBuckets,
  buildRepoHotspots,
  buildFlowStateGraph,
  buildHotspotCascade,
} from '../../lib/metrics';
import { MetricCard } from './MetricCard';
import { StalePRsCard } from './StalePRsCard';
import { WaitingReviewCard } from './WaitingReviewCard';
import { RecentlyMergedCard } from './RecentlyMergedCard';
import { PRVelocityChart } from '../charts/PRVelocityChart';
import { CycleTimeChart } from '../charts/CycleTimeChart';
import { WeeklyDigestCard } from './WeeklyDigestCard';
import { TrendSummaryCard } from './TrendSummaryCard';
import { HotspotPriorityQueueCard } from './HotspotPriorityQueueCard';
import { RiskBucketsCard } from './RiskBucketsCard';
import { QueueHealthCard } from './QueueHealthCard';
import { PRAgingLadderCard } from './PRAgingLadderCard';
import { MergeReadinessRadarCard } from './MergeReadinessRadarCard';
import { RepoHotspotsCard } from './RepoHotspotsCard';
import { FlowStateGraphCard } from './FlowStateGraphCard';
import { HotspotCascadeCard } from './HotspotCascadeCard';
import {
  GitPullRequest,
  GitMerge,
  Clock,
  Eye,
  AlertTriangle,
  ListTodo,
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';

interface Props {
  prs: PullRequest[];
  reviews: PRReview[];
  loading: boolean;
}

export function OverviewDashboard({ prs, reviews, loading }: Props) {
  const { timeRange, staleDaysThreshold } = useSettingsStore();
  const since = useMemo(() => getSinceDate(timeRange), [timeRange]);

  const currentWindowPRs = useMemo(
    () => prs.filter((pr) => new Date(pr.updated_at) >= since),
    [prs, since]
  );
  const currentWindowReviews = useMemo(
    () => reviews.filter((review) => new Date(review.submitted_at) >= since),
    [reviews, since]
  );

  const metrics = useMemo(
    () => (prs.length > 0 ? computeMetrics(prs, reviews, staleDaysThreshold) : null),
    [prs, reviews, staleDaysThreshold]
  );
  const trendSummary = useMemo(
    () => buildTrendSummary(prs, reviews, since, staleDaysThreshold),
    [prs, reviews, since, staleDaysThreshold]
  );
  const weeklyData = useMemo(() => buildWeeklyData(currentWindowPRs, since), [currentWindowPRs, since]);
  const cycleTimeData = useMemo(() => buildCycleTimeData(currentWindowPRs, since), [currentWindowPRs, since]);
  const weeklyDigest = useMemo(
    () => (currentWindowPRs.length > 0 ? buildWeeklyDigest(currentWindowPRs, currentWindowReviews) : null),
    [currentWindowPRs, currentWindowReviews]
  );
  const hotspotQueue = useMemo(
    () => buildHotspotQueue(prs, staleDaysThreshold),
    [prs, staleDaysThreshold]
  );
  const riskBuckets = useMemo(
    () => buildRiskBuckets(prs, staleDaysThreshold),
    [prs, staleDaysThreshold]
  );
  const queueHealth = useMemo(() => buildQueueHealth(prs), [prs]);
  const agingBuckets = useMemo(() => buildPRAgingBuckets(prs), [prs]);
  const mergeReadiness = useMemo(() => buildMergeReadinessBuckets(prs), [prs]);
  const repoHotspots = useMemo(
    () => buildRepoHotspots(prs, staleDaysThreshold),
    [prs, staleDaysThreshold]
  );
  const flowStateGraph = useMemo(
    () => buildFlowStateGraph(prs, trendSummary.merged.current ?? 0),
    [prs, trendSummary.merged.current]
  );
  const hotspotCascade = useMemo(
    () => buildHotspotCascade(prs, staleDaysThreshold),
    [prs, staleDaysThreshold]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5 p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Open PRs"
            value={loading ? '…' : formatNumber(metrics?.open ?? 0)}
            subValue={`${metrics?.draft ?? 0} drafts live`}
            icon={<GitPullRequest className="h-4 w-4" />}
            iconColor="text-brand-600 dark:text-brand-400"
            loading={loading}
          />
          <MetricCard
            label="Merged"
            value={loading ? '…' : formatNumber(trendSummary.merged.current ?? metrics?.merged ?? 0)}
            subValue="selected window"
            icon={<GitMerge className="h-4 w-4" />}
            iconColor="text-green-600 dark:text-green-400"
            trend={trendSummary.merged.trend}
            trendLabel={
              trendSummary.merged.previous !== null
                ? `${trendSummary.merged.previous} previous window`
                : undefined
            }
            loading={loading}
          />
          <MetricCard
            label="Avg Cycle Time"
            value={loading ? '…' : formatDuration(trendSummary.cycleTime.current ?? metrics?.avgCycleTimeHours ?? null)}
            subValue="open → merged"
            icon={<Clock className="h-4 w-4" />}
            iconColor="text-violet-600 dark:text-violet-400"
            trend={trendSummary.cycleTime.trend}
            trendLabel={
              trendSummary.cycleTime.previous !== null
                ? `${formatDuration(trendSummary.cycleTime.previous)} previous`
                : undefined
            }
            loading={loading}
          />
          <MetricCard
            label="Time to 1st Review"
            value={loading ? '…' : formatDuration(trendSummary.timeToFirstReview.current ?? metrics?.avgTimeToFirstReviewHours ?? null)}
            subValue="open → first review"
            icon={<Eye className="h-4 w-4" />}
            iconColor="text-blue-600 dark:text-blue-400"
            trend={trendSummary.timeToFirstReview.trend}
            trendLabel={
              trendSummary.timeToFirstReview.previous !== null
                ? `${formatDuration(trendSummary.timeToFirstReview.previous)} previous`
                : undefined
            }
            loading={loading}
          />
          <MetricCard
            label="Stale PRs"
            value={loading ? '…' : formatNumber(metrics?.stale ?? 0)}
            subValue={`>${staleDaysThreshold} days idle`}
            icon={<AlertTriangle className="h-4 w-4" />}
            iconColor={metrics && metrics.stale > 0 ? 'text-red-500' : 'text-slate-400'}
            alert={!loading && (metrics?.stale ?? 0) > 0}
            loading={loading}
          />
          <MetricCard
            label="Awaiting Review"
            value={loading ? '…' : formatNumber(metrics?.waitingReview ?? 0)}
            subValue="active queue"
            icon={<ListTodo className="h-4 w-4" />}
            iconColor={metrics && metrics.waitingReview > 3 ? 'text-amber-500' : 'text-slate-400'}
            alert={!loading && (metrics?.waitingReview ?? 0) > 5}
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr,1fr]">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PRVelocityChart data={weeklyData} loading={loading} />
            <CycleTimeChart data={cycleTimeData} loading={loading} />
          </div>
          <TrendSummaryCard summary={trendSummary} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr,0.85fr,0.8fr]">
          <HotspotPriorityQueueCard items={hotspotQueue} loading={loading} />
          <QueueHealthCard queueHealth={queueHealth} loading={loading} />
          <WeeklyDigestCard digest={weeklyDigest} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,1fr]">
          <FlowStateGraphCard nodes={flowStateGraph} loading={loading} />
          <MergeReadinessRadarCard buckets={mergeReadiness} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr,0.9fr]">
          <HotspotCascadeCard data={hotspotCascade} loading={loading} />
          <RepoHotspotsCard hotspots={repoHotspots} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <StalePRsCard prs={prs} staleDays={staleDaysThreshold} loading={loading} />
          <WaitingReviewCard prs={prs} loading={loading} />
          <RiskBucketsCard buckets={riskBuckets} loading={loading} />
          <PRAgingLadderCard buckets={agingBuckets} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <RecentlyMergedCard prs={currentWindowPRs} loading={loading} />
        </div>

        <div className="pb-4 text-center text-xs text-slate-400">
          Overview for the last {timeRange.replace('d', ' days')} •{' '}
          {loading ? 'Loading...' : `${prs.length} PRs loaded for analysis`}
        </div>
      </div>
    </div>
  );
}
