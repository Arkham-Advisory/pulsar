import { useMemo } from 'react';
import type { PullRequest, PRReview } from '../../types/github';
import { useSettingsStore } from '../../store/settings';
import {
  getSinceDate,
  buildAuthorStats,
  buildReviewerStats,
  buildContributorHeatmap,
  buildBottleneckFunnel,
  buildSLAHeatmap,
  buildReviewLoadImbalance,
  buildCollaborationCoverage,
  filterTeamInsightData,
  buildReviewDependencyMap,
  buildRepoKnowledgeGraph,
  buildHandoffFriction,
  buildTeamOperatingModes,
} from '../../lib/metrics';
import { ReviewWorkloadChart } from '../charts/ReviewWorkloadChart';
import { AuthorActivityTable } from '../charts/AuthorActivityTable';
import { ContributorHeatmap } from '../charts/ContributorHeatmap';
import { BottleneckFunnelChart } from '../charts/BottleneckFunnelChart';
import { SLAHeatmapChart } from '../charts/SLAHeatmapChart';
import { ReviewLoadBalanceCard } from './ReviewLoadBalanceCard';
import { CollaborationCoverageCard } from './CollaborationCoverageCard';
import { ReviewDependencyMapCard } from './ReviewDependencyMapCard';
import { KnowledgeSpreadCard } from './KnowledgeSpreadCard';
import { HandoffFrictionCard } from './HandoffFrictionCard';
import { TeamOperatingModesCard } from './TeamOperatingModesCard';

interface Props {
  prs: PullRequest[];
  reviews: PRReview[];
  loading: boolean;
}

export function TeamDashboard({ prs, reviews, loading }: Props) {
  const { timeRange, slaPolicy } = useSettingsStore();
  const since = useMemo(() => getSinceDate(timeRange), [timeRange]);

  const currentWindowPRs = useMemo(
    () => prs.filter((pr) => new Date(pr.updated_at) >= since),
    [prs, since]
  );
  const currentWindowReviews = useMemo(
    () => reviews.filter((review) => new Date(review.submitted_at) >= since),
    [reviews, since]
  );
  const teamInsightData = useMemo(
    () => filterTeamInsightData(currentWindowPRs, currentWindowReviews),
    [currentWindowPRs, currentWindowReviews]
  );
  const teamPRs = teamInsightData.prs;
  const teamReviews = teamInsightData.reviews;

  const authorStats = useMemo(
    () => buildAuthorStats(teamPRs, teamReviews),
    [teamPRs, teamReviews]
  );
  const reviewerStats = useMemo(
    () => buildReviewerStats(teamPRs, teamReviews),
    [teamPRs, teamReviews]
  );
  const contributorHeatmap = useMemo(
    () => buildContributorHeatmap(teamPRs, teamReviews, since),
    [teamPRs, teamReviews, since]
  );
  const bottleneckData = useMemo(
    () => buildBottleneckFunnel(currentWindowPRs, currentWindowReviews),
    [currentWindowPRs, currentWindowReviews]
  );
  const slaHeatmapData = useMemo(
    () => buildSLAHeatmap(teamPRs, teamReviews),
    [teamPRs, teamReviews]
  );
  const imbalance = useMemo(() => buildReviewLoadImbalance(reviewerStats), [reviewerStats]);
  const collaborationCoverage = useMemo(
    () => buildCollaborationCoverage(authorStats, reviewerStats),
    [authorStats, reviewerStats]
  );
  const reviewDependencies = useMemo(() => buildReviewDependencyMap(teamPRs), [teamPRs]);
  const repoKnowledgeGraph = useMemo(
    () => buildRepoKnowledgeGraph(teamPRs, teamReviews),
    [teamPRs, teamReviews]
  );
  const handoffFriction = useMemo(
    () => buildHandoffFriction(slaHeatmapData),
    [slaHeatmapData]
  );
  const operatingModes = useMemo(
    () => buildTeamOperatingModes(authorStats),
    [authorStats]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5 p-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,1fr,1.2fr]">
          <ReviewLoadBalanceCard imbalance={imbalance} loading={loading} />
          <CollaborationCoverageCard coverage={collaborationCoverage} loading={loading} />
          <ReviewWorkloadChart data={reviewerStats} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <BottleneckFunnelChart data={bottleneckData} loading={loading} />
          <SLAHeatmapChart data={slaHeatmapData} slaPolicy={slaPolicy} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ReviewDependencyMapCard dependencies={reviewDependencies} loading={loading} />
          <KnowledgeSpreadCard data={repoKnowledgeGraph} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <HandoffFrictionCard rows={handoffFriction} loading={loading} />
          <TeamOperatingModesCard rows={operatingModes} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <AuthorActivityTable data={authorStats} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <ContributorHeatmap data={contributorHeatmap} since={since} loading={loading} />
        </div>

        <div className="pb-4 text-center text-xs text-slate-400">
          Team health for the last {timeRange.replace('d', ' days')} •{' '}
          {loading ? 'Loading...' : `${teamPRs.length} human-authored PRs in the active window`}
        </div>
      </div>
    </div>
  );
}
