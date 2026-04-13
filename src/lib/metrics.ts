import type {
  PullRequest,
  PRReview,
  PRMetrics,
  WeeklyDataPoint,
  CycleTimeDataPoint,
  AuthorStats,
  ReviewerStats,
  PRSizeCategory,
  WeeklyDigest,
  HeatmapContributor,
  BottleneckPhaseData,
  SLAHeatmapRow,
  TrendSummary,
  MetricDelta,
  HotspotItem,
  RiskBucket,
  QueueHealth,
  PRAgingBucket,
  ReviewLoadImbalance,
  CollaborationCoverage,
  MergeReadinessBucket,
  RepoHotspot,
  ReviewDependencyEdge,
  KnowledgeSpreadRow,
  HandoffFrictionRow,
  TeamOperatingModeRow,
  FlowStateNode,
  HotspotCascadeRepo,
  RepoKnowledgeGraph,
} from '../types/github';
import {
  format,
  differenceInHours,
  differenceInDays,
  eachWeekOfInterval,
  isWithinInterval,
  startOfDay,
  addWeeks,
} from 'date-fns';

export function isBotLogin(login: string): boolean {
  return login.endsWith('[bot]');
}

export function getRepoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}

export function filterTeamInsightData(
  prs: PullRequest[],
  reviews: PRReview[],
): { prs: PullRequest[]; reviews: PRReview[] } {
  const humanPRs = prs
    .filter((pr) => !isBotLogin(pr.user.login))
    .map((pr) => ({
      ...pr,
      requested_reviewers: pr.requested_reviewers.filter((reviewer) => !isBotLogin(reviewer.login)),
      assignees: pr.assignees.filter((assignee) => !isBotLogin(assignee.login)),
    }));

  const prKeys = new Set(humanPRs.map((pr) => `${pr.repo}#${pr.number}`));
  const humanReviews = reviews.filter(
    (review) => !isBotLogin(review.user.login) && prKeys.has(`${review.repo}#${review.pr_number}`)
  );

  return { prs: humanPRs, reviews: humanReviews };
}

// Categorize PR by size (lines changed)
export function getPRSizeLabel(additions: number, deletions: number): string {
  const total = additions + deletions;
  if (total <= 10) return 'Tiny';
  if (total <= 100) return 'Small';
  if (total <= 500) return 'Medium';
  if (total <= 1000) return 'Large';
  return 'Huge';
}

// Check if a PR is stale (open and not updated for N days)
export function isPRStale(pr: PullRequest, staleDays: number): boolean {
  if (pr.state !== 'open' || pr.draft) return false;
  const lastUpdate = new Date(pr.updated_at);
  const diffHours = differenceInHours(new Date(), lastUpdate);
  return diffHours > staleDays * 24;
}

// Compute overall metrics
export function computeMetrics(
  prs: PullRequest[],
  reviews: PRReview[],
  staleDaysThreshold: number
): PRMetrics {
  const open = prs.filter((pr) => pr.state === 'open' && !pr.draft);
  const draft = prs.filter((pr) => pr.draft);
  const merged = prs.filter((pr) => pr.merged);
  const closed = prs.filter((pr) => pr.state === 'closed' && !pr.merged);
  const stale = prs.filter((pr) => isPRStale(pr, staleDaysThreshold));
  const waitingReview = open.filter(
    (pr) => pr.requested_reviewers.length > 0
  );

  // Avg cycle time (hours from created to merged)
  const mergedWithTime = merged.filter((pr) => pr.merged_at);
  const cycleTimes = mergedWithTime.map((pr) =>
    differenceInHours(new Date(pr.merged_at!), new Date(pr.created_at))
  );
  const avgCycleTimeHours =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;

  // Avg time to first review
  const firstReviewTimes: number[] = [];
  const reviewsByPR = new Map<string, PRReview[]>();
  for (const r of reviews) {
    const key = `${r.repo}#${r.pr_number}`;
    if (!reviewsByPR.has(key)) reviewsByPR.set(key, []);
    reviewsByPR.get(key)!.push(r);
  }

  for (const pr of prs) {
    const key = `${pr.repo}#${pr.number}`;
    const prReviews = reviewsByPR.get(key);
    if (prReviews && prReviews.length > 0) {
      const firstReview = prReviews.reduce((a, b) =>
        new Date(a.submitted_at) < new Date(b.submitted_at) ? a : b
      );
      const hours = differenceInHours(
        new Date(firstReview.submitted_at),
        new Date(pr.created_at)
      );
      if (hours >= 0) firstReviewTimes.push(hours);
    }
  }

  const avgTimeToFirstReviewHours =
    firstReviewTimes.length > 0
      ? firstReviewTimes.reduce((a, b) => a + b, 0) / firstReviewTimes.length
      : null;

  const sizes = prs.map((pr) => pr.additions + pr.deletions);
  const avgPRSize =
    sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;

  const mergeRate =
    merged.length + closed.length > 0
      ? (merged.length / (merged.length + closed.length)) * 100
      : 0;

  return {
    total: prs.length,
    open: open.length,
    merged: merged.length,
    closed: closed.length,
    draft: draft.length,
    stale: stale.length,
    waitingReview: waitingReview.length,
    avgCycleTimeHours,
    avgTimeToFirstReviewHours,
    avgPRSize,
    mergeRate,
  };
}

// Build weekly data points for velocity chart
export function buildWeeklyData(prs: PullRequest[], since: Date, now: Date = new Date()): WeeklyDataPoint[] {
  const weeks = eachWeekOfInterval({ start: since, end: now }, { weekStartsOn: 1 });
  return weeks.map((weekStart) => {
    const weekEnd = addWeeks(weekStart, 1);
    const label = format(weekStart, 'MMM d');
    const interval = { start: weekStart, end: weekEnd };

    const opened = prs.filter((pr) =>
      isWithinInterval(new Date(pr.created_at), interval)
    ).length;

    const merged = prs.filter(
      (pr) => pr.merged_at && isWithinInterval(new Date(pr.merged_at), interval)
    ).length;

    const closed = prs.filter(
      (pr) =>
        pr.closed_at &&
        !pr.merged &&
        isWithinInterval(new Date(pr.closed_at), interval)
    ).length;

    return { week: label, opened, merged, closed };
  });
}

// Build weekly average cycle time
export function buildCycleTimeData(prs: PullRequest[], since: Date, now: Date = new Date()): CycleTimeDataPoint[] {
  const weeks = eachWeekOfInterval({ start: since, end: now }, { weekStartsOn: 1 });
  return weeks.map((weekStart) => {
    const weekEnd = addWeeks(weekStart, 1);
    const label = format(weekStart, 'MMM d');
    const interval = { start: weekStart, end: weekEnd };

    const mergedInWeek = prs.filter(
      (pr) => pr.merged_at && isWithinInterval(new Date(pr.merged_at), interval)
    );

    if (mergedInWeek.length === 0) return { week: label, avgHours: 0, count: 0 };

    const totalHours = mergedInWeek.reduce((sum, pr) => {
      return sum + differenceInHours(new Date(pr.merged_at!), new Date(pr.created_at));
    }, 0);

    return {
      week: label,
      avgHours: Math.round(totalHours / mergedInWeek.length),
      count: mergedInWeek.length,
    };
  });
}

// Author statistics
export function buildAuthorStats(prs: PullRequest[], reviews: PRReview[]): AuthorStats[] {
  const authorMap = new Map<string, AuthorStats>();

  for (const pr of prs) {
    const login = pr.user.login;
    if (!authorMap.has(login)) {
      authorMap.set(login, {
        login,
        avatar_url: pr.user.avatar_url,
        prsOpened: 0,
        prsMerged: 0,
        openPRs: 0,
        reviewsGiven: 0,
        avgCycleTimeHours: null,
        avgTimeToFirstReviewHours: null,
      });
    }
    const stats = authorMap.get(login)!;
    stats.prsOpened++;
    if (pr.merged) {
      stats.prsMerged++;
    }
    if (pr.state === 'open' && !pr.draft) {
      stats.openPRs++;
    }
  }

  // Cycle time per author
  const cycleTimesByAuthor = new Map<string, number[]>();
  for (const pr of prs.filter((p) => p.merged && p.merged_at)) {
    const login = pr.user.login;
    if (!cycleTimesByAuthor.has(login)) cycleTimesByAuthor.set(login, []);
    cycleTimesByAuthor
      .get(login)!
      .push(differenceInHours(new Date(pr.merged_at!), new Date(pr.created_at)));
  }
  for (const [login, times] of cycleTimesByAuthor) {
    if (authorMap.has(login)) {
      authorMap.get(login)!.avgCycleTimeHours =
        times.reduce((a, b) => a + b, 0) / times.length;
    }
  }

  // Avg time to first review per author
  const reviewsByPR = new Map<string, PRReview[]>();
  for (const r of reviews) {
    const key = `${r.repo}#${r.pr_number}`;
    if (!reviewsByPR.has(key)) reviewsByPR.set(key, []);
    reviewsByPR.get(key)!.push(r);
  }
  const firstReviewTimesByAuthor = new Map<string, number[]>();
  for (const pr of prs) {
    const key = `${pr.repo}#${pr.number}`;
    const prReviews = reviewsByPR.get(key);
    if (prReviews && prReviews.length > 0) {
      const firstReview = prReviews.reduce((a, b) =>
        new Date(a.submitted_at) < new Date(b.submitted_at) ? a : b
      );
      const hours = differenceInHours(
        new Date(firstReview.submitted_at),
        new Date(pr.created_at)
      );
      if (hours >= 0) {
        const login = pr.user.login;
        if (!firstReviewTimesByAuthor.has(login)) firstReviewTimesByAuthor.set(login, []);
        firstReviewTimesByAuthor.get(login)!.push(hours);
      }
    }
  }
  for (const [login, times] of firstReviewTimesByAuthor) {
    if (authorMap.has(login)) {
      authorMap.get(login)!.avgTimeToFirstReviewHours =
        times.reduce((a, b) => a + b, 0) / times.length;
    }
  }

  // Reviews given by author
  for (const review of reviews) {
    const login = review.user.login;
    if (authorMap.has(login)) {
      authorMap.get(login)!.reviewsGiven++;
    }
  }

  return Array.from(authorMap.values())
    .sort((a, b) => b.prsOpened - a.prsOpened)
    .slice(0, 15);
}

// Reviewer workload
export function buildReviewerStats(prs: PullRequest[], reviews: PRReview[]): ReviewerStats[] {
  const reviewerMap = new Map<string, ReviewerStats & { _responseTimes: number[] }>();

  // Pending reviewers from open PRs
  for (const pr of prs.filter((p) => p.state === 'open' && !p.draft)) {
    for (const reviewer of pr.requested_reviewers) {
      const login = reviewer.login;
      if (!reviewerMap.has(login)) {
        reviewerMap.set(login, {
          login,
          avatar_url: reviewer.avatar_url,
          reviewsPending: 0,
          reviewsCompleted: 0,
          changesRequested: 0,
          avgResponseHours: null,
          _responseTimes: [],
        });
      }
      reviewerMap.get(login)!.reviewsPending++;
    }
  }

  // Completed reviews
  const reviewsByReviewer = new Map<string, PRReview[]>();
  for (const r of reviews) {
    if (!reviewsByReviewer.has(r.user.login)) reviewsByReviewer.set(r.user.login, []);
    reviewsByReviewer.get(r.user.login)!.push(r);
  }

  for (const [login, reviewList] of reviewsByReviewer) {
    if (!reviewerMap.has(login) && reviewList.length > 0) {
      reviewerMap.set(login, {
        login,
        avatar_url: reviewList[0].user.avatar_url,
        reviewsPending: 0,
        reviewsCompleted: 0,
        changesRequested: 0,
        avgResponseHours: null,
        _responseTimes: [],
      });
    }
    if (reviewerMap.has(login)) {
      reviewerMap.get(login)!.reviewsCompleted += reviewList.length;
      reviewerMap.get(login)!.changesRequested += reviewList.filter(
        (r) => r.state === 'CHANGES_REQUESTED'
      ).length;
    }
  }

  return Array.from(reviewerMap.values())
    .map(({ _responseTimes, ...rest }) => rest)
    .sort((a, b) => b.reviewsCompleted - a.reviewsCompleted)
    .slice(0, 10);
}

// PR size distribution
export function buildSizeDistribution(prs: PullRequest[]): PRSizeCategory[] {
  const counts = { Tiny: 0, Small: 0, Medium: 0, Large: 0, Huge: 0 };
  for (const pr of prs) {
    const label = getPRSizeLabel(pr.additions, pr.deletions) as keyof typeof counts;
    counts[label]++;
  }
  return [
    { label: 'Tiny', count: counts.Tiny, color: '#22c55e' },
    { label: 'Small', count: counts.Small, color: '#3b82f6' },
    { label: 'Medium', count: counts.Medium, color: '#f59e0b' },
    { label: 'Large', count: counts.Large, color: '#f97316' },
    { label: 'Huge', count: counts.Huge, color: '#ef4444' },
  ];
}

// Format hours to readable string
export function formatDuration(hours: number | null): string {
  if (hours === null) return 'N/A';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remainHours = Math.round(hours % 24);
  if (remainHours === 0) return `${days}d`;
  return `${days}d ${remainHours}h`;
}

export function getTimeRangeDays(timeRange: string): number {
  return Number.parseInt(timeRange, 10);
}

// Get since date from time range
export function getSinceDate(timeRange: string): Date {
  const now = new Date();
  const days = getTimeRangeDays(timeRange);
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  return startOfDay(since);
}

export function getDashboardComparisonSinceDate(timeRange: string): Date {
  const now = new Date();
  const days = getTimeRangeDays(timeRange) * 2;
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  return startOfDay(since);
}

function getPreviousPeriodBounds(since: Date, now: Date): { start: Date; end: Date } {
  const durationMs = now.getTime() - since.getTime();
  return {
    start: new Date(since.getTime() - durationMs),
    end: since,
  };
}

function toMetricDelta(
  current: number | null,
  previous: number | null,
  betterWhen: 'higher' | 'lower'
): MetricDelta {
  if (current === null || previous === null) {
    return { current, previous, delta: null, trend: 'neutral' };
  }
  const delta = current - previous;
  if (delta === 0) return { current, previous, delta, trend: 'neutral' };

  const improving = betterWhen === 'higher' ? delta > 0 : delta < 0;
  return {
    current,
    previous,
    delta,
    trend: improving ? 'up' : 'down',
  };
}

export function buildTrendSummary(
  prs: PullRequest[],
  reviews: PRReview[],
  since: Date,
  staleDaysThreshold: number,
  now: Date = new Date()
): TrendSummary {
  const currentMetrics = computeMetrics(
    prs.filter((pr) => new Date(pr.updated_at) >= since),
    reviews.filter((review) => new Date(review.submitted_at) >= since),
    staleDaysThreshold
  );
  const previousBounds = getPreviousPeriodBounds(since, now);
  const previousMetrics = computeMetrics(
    prs.filter((pr) => {
      const updatedAt = new Date(pr.updated_at);
      return updatedAt >= previousBounds.start && updatedAt < previousBounds.end;
    }),
    reviews.filter((review) => {
      const submittedAt = new Date(review.submitted_at);
      return submittedAt >= previousBounds.start && submittedAt < previousBounds.end;
    }),
    staleDaysThreshold
  );

  return {
    merged: toMetricDelta(currentMetrics.merged, previousMetrics.merged, 'higher'),
    cycleTime: toMetricDelta(
      currentMetrics.avgCycleTimeHours,
      previousMetrics.avgCycleTimeHours,
      'lower'
    ),
    timeToFirstReview: toMetricDelta(
      currentMetrics.avgTimeToFirstReviewHours,
      previousMetrics.avgTimeToFirstReviewHours,
      'lower'
    ),
  };
}

// Build weekly digest for the last 7 days vs previous 7 days
export function buildWeeklyDigest(
  prs: PullRequest[],
  reviews: PRReview[],
  now: Date = new Date()
): WeeklyDigest {
  const weekStart = startOfDay(new Date(now));
  weekStart.setDate(weekStart.getDate() - 6);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const inCurrentWeek = (d: Date) => d >= weekStart && d <= now;
  const inPrevWeek = (d: Date) => d >= prevWeekStart && d < weekStart;

  const mergedThisWeek = prs.filter(
    (pr) => pr.merged_at && inCurrentWeek(new Date(pr.merged_at))
  );
  const mergedPrevWeek = prs.filter(
    (pr) => pr.merged_at && inPrevWeek(new Date(pr.merged_at))
  );

  const avgCycleTimeHours =
    mergedThisWeek.length > 0
      ? mergedThisWeek.reduce(
          (sum, pr) =>
            sum + differenceInHours(new Date(pr.merged_at!), new Date(pr.created_at)),
          0
        ) / mergedThisWeek.length
      : null;

  const openPRs = prs.filter((pr) => pr.state === 'open' && !pr.draft);
  const draftPRs = prs.filter((pr) => pr.draft);

  // Avg time to first review for PRs created this week
  const reviewsByPR = new Map<string, PRReview[]>();
  for (const r of reviews) {
    const key = `${r.repo}#${r.pr_number}`;
    if (!reviewsByPR.has(key)) reviewsByPR.set(key, []);
    reviewsByPR.get(key)!.push(r);
  }
  const firstReviewTimes: number[] = [];
  for (const pr of prs.filter((p) => inCurrentWeek(new Date(p.created_at)))) {
    const key = `${pr.repo}#${pr.number}`;
    const prReviews = reviewsByPR.get(key);
    if (prReviews && prReviews.length > 0) {
      const first = prReviews.reduce((a, b) =>
        new Date(a.submitted_at) < new Date(b.submitted_at) ? a : b
      );
      const h = differenceInHours(new Date(first.submitted_at), new Date(pr.created_at));
      if (h >= 0) firstReviewTimes.push(h);
    }
  }
  const avgTimeToFirstReviewHours =
    firstReviewTimes.length > 0
      ? firstReviewTimes.reduce((a, b) => a + b, 0) / firstReviewTimes.length
      : null;

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(now, 'MMM d')}`;

  return {
    weekLabel,
    merges: mergedThisWeek.length,
    prevWeekMerges: mergedPrevWeek.length,
    avgCycleTimeHours,
    openCount: openPRs.length,
    draftCount: draftPRs.length,
    avgTimeToFirstReviewHours,
  };
}

// Build per-contributor activity heatmap data.
// Returns top-N contributors (by total activity) with per-day review/merge counts.
export function buildContributorHeatmap(
  prs: PullRequest[],
  reviews: PRReview[],
  since: Date,
  now: Date = new Date()
): HeatmapContributor[] {
  const contributors = new Map<string, HeatmapContributor>();

  function ensure(login: string, avatar: string) {
    if (!contributors.has(login)) {
      contributors.set(login, { login, avatar_url: avatar, days: {}, totalActivity: 0 });
    }
    return contributors.get(login)!;
  }

  function dayKey(date: Date): string {
    return format(date, 'yyyy-MM-dd');
  }

  // Reviews
  for (const review of reviews) {
    const d = new Date(review.submitted_at);
    if (d < since || d > now) continue;
    const c = ensure(review.user.login, review.user.avatar_url);
    const key = dayKey(d);
    if (!c.days[key]) c.days[key] = { reviews: 0, merges: 0 };
    c.days[key].reviews++;
    c.totalActivity++;
  }

  // Merges (attributed to PR author)
  for (const pr of prs) {
    if (!pr.merged || !pr.merged_at) continue;
    const d = new Date(pr.merged_at);
    if (d < since || d > now) continue;
    const c = ensure(pr.user.login, pr.user.avatar_url);
    const key = dayKey(d);
    if (!c.days[key]) c.days[key] = { reviews: 0, merges: 0 };
    c.days[key].merges++;
    c.totalActivity++;
  }

  return Array.from(contributors.values())
    .filter((c) => c.totalActivity > 0)
    .sort((a, b) => b.totalActivity - a.totalActivity)
    .slice(0, 12);
}

// ─── Bottleneck Funnel ────────────────────────────────────────────────────────
// Computes average time spent in each phase for merged PRs:
//   open → first review → first approval → merged
export function buildBottleneckFunnel(
  prs: PullRequest[],
  reviews: PRReview[]
): BottleneckPhaseData[] {
  const reviewsByPR = new Map<string, PRReview[]>();
  for (const r of reviews) {
    const key = `${r.repo}#${r.pr_number}`;
    if (!reviewsByPR.has(key)) reviewsByPR.set(key, []);
    reviewsByPR.get(key)!.push(r);
  }

  const phase1: number[] = []; // open → first review
  const phase2: number[] = []; // first review → first approval
  const phase3: number[] = []; // first approval → merge

  for (const pr of prs.filter((p) => p.merged && p.merged_at)) {
    const key = `${pr.repo}#${pr.number}`;
    const prReviews = reviewsByPR.get(key) ?? [];
    if (prReviews.length === 0) continue;

    const sorted = [...prReviews].sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    );
    const firstReview = sorted[0];
    const firstReviewAt = new Date(firstReview.submitted_at);

    const h1 = differenceInHours(firstReviewAt, new Date(pr.created_at));
    if (h1 >= 0) phase1.push(h1);

    const firstApproval = sorted.find((r) => r.state === 'APPROVED');
    if (firstApproval) {
      const firstApprovalAt = new Date(firstApproval.submitted_at);
      const h2 = differenceInHours(firstApprovalAt, firstReviewAt);
      if (h2 >= 0) phase2.push(h2);
      const h3 = differenceInHours(new Date(pr.merged_at!), firstApprovalAt);
      if (h3 >= 0) phase3.push(h3);
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return [
    { phase: 'Open → 1st Review', avgHours: avg(phase1), count: phase1.length },
    { phase: '1st Review → Approval', avgHours: avg(phase2), count: phase2.length },
    { phase: 'Approval → Merge', avgHours: avg(phase3), count: phase3.length },
  ];
}

// ─── SLA Heatmap ─────────────────────────────────────────────────────────────
// Per-author average time per phase, for color-coding against SLA targets.
export function buildSLAHeatmap(
  prs: PullRequest[],
  reviews: PRReview[],
): SLAHeatmapRow[] {
  const reviewsByPR = new Map<string, PRReview[]>();
  for (const r of reviews) {
    const key = `${r.repo}#${r.pr_number}`;
    if (!reviewsByPR.has(key)) reviewsByPR.set(key, []);
    reviewsByPR.get(key)!.push(r);
  }

  type AuthorBuckets = {
    avatar_url: string;
    phase1: number[];
    phase2: number[];
    phase3: number[];
  };
  const authorMap = new Map<string, AuthorBuckets>();

  for (const pr of prs.filter((p) => p.merged && p.merged_at)) {
    const key = `${pr.repo}#${pr.number}`;
    const prReviews = reviewsByPR.get(key) ?? [];
    if (prReviews.length === 0) continue;

    const login = pr.user.login;
    if (!authorMap.has(login)) {
      authorMap.set(login, { avatar_url: pr.user.avatar_url, phase1: [], phase2: [], phase3: [] });
    }
    const buckets = authorMap.get(login)!;

    const sorted = [...prReviews].sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    );
    const firstReview = sorted[0];
    const firstReviewAt = new Date(firstReview.submitted_at);

    const h1 = differenceInHours(firstReviewAt, new Date(pr.created_at));
    if (h1 >= 0) buckets.phase1.push(h1);

    const firstApproval = sorted.find((r) => r.state === 'APPROVED');
    if (firstApproval) {
      const firstApprovalAt = new Date(firstApproval.submitted_at);
      const h2 = differenceInHours(firstApprovalAt, firstReviewAt);
      if (h2 >= 0) buckets.phase2.push(h2);
      const h3 = differenceInHours(new Date(pr.merged_at!), firstApprovalAt);
      if (h3 >= 0) buckets.phase3.push(h3);
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return Array.from(authorMap.entries())
    .map(([login, b]) => ({
      login,
      avatar_url: b.avatar_url,
      openToFirstReview: avg(b.phase1),
      firstReviewToApproval: avg(b.phase2),
      approvalToMerge: avg(b.phase3),
      prCount: b.phase1.length,
    }))
    .filter((r) => r.prCount > 0)
    .sort((a, b) => b.prCount - a.prCount)
    .slice(0, 15);
}

export function buildHotspotQueue(
  prs: PullRequest[],
  staleDaysThreshold: number,
): HotspotItem[] {
  return prs
    .filter((pr) => pr.state === 'open' && !pr.draft)
    .map((pr) => {
      const ageDays = differenceInDays(new Date(), new Date(pr.updated_at));
      const totalChanges = pr.additions + pr.deletions;
      let score = 0;
      let tone: HotspotItem['tone'] = 'neutral';
      let reason = 'Watch';

      if (ageDays >= staleDaysThreshold) {
        score += 5 + Math.min(ageDays - staleDaysThreshold, 7);
        tone = 'danger';
        reason = 'Stale';
      }
      if (pr.requested_reviewers.length > 0) {
        score += 4;
        if (tone === 'neutral') tone = 'warning';
        reason = reason === 'Stale' ? 'Stale + waiting review' : 'Waiting review';
      }
      if (pr.ciStatus === 'failure') {
        score += 4;
        tone = 'danger';
        reason = reason === 'Watch' ? 'Failing CI' : `${reason} + failing CI`;
      }
      if (totalChanges >= 500) {
        score += 2;
        if (tone === 'neutral') tone = 'warning';
        reason = reason === 'Watch' ? 'Large PR' : `${reason} + large PR`;
      }
      if (pr.comments + pr.review_comments >= 15) {
        score += 1;
      }

      return {
        id: `${pr.repo}#${pr.number}`,
        title: pr.title,
        subtitle: `${pr.repo.split('/')[1]} #${pr.number} · ${pr.user.login}`,
        reason,
        score,
        tone,
        ageLabel: `${ageDays}d idle`,
        url: pr.html_url,
        ownerLogin: pr.user.login,
        repoLabel: pr.repo.split('/')[1],
        repoUrl: getRepoUrl(pr.repo),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function buildRiskBuckets(prs: PullRequest[], staleDaysThreshold: number): RiskBucket[] {
  const openPRs = prs.filter((pr) => pr.state === 'open' && !pr.draft);

  return [
    {
      label: 'Stale',
      count: openPRs.filter((pr) => differenceInDays(new Date(), new Date(pr.updated_at)) >= staleDaysThreshold).length,
      tone: 'danger',
      description: `No activity for ${staleDaysThreshold}+ days`,
    },
    {
      label: 'Failing CI',
      count: openPRs.filter((pr) => pr.ciStatus === 'failure').length,
      tone: 'danger',
      description: 'Checks are currently failing',
    },
    {
      label: 'Large PRs',
      count: openPRs.filter((pr) => pr.additions + pr.deletions >= 500).length,
      tone: 'warning',
      description: '500+ changed lines',
    },
    {
      label: 'High discussion',
      count: openPRs.filter((pr) => pr.comments + pr.review_comments >= 15).length,
      tone: 'warning',
      description: '15+ comments and review comments',
    },
  ];
}

export function buildQueueHealth(prs: PullRequest[]): QueueHealth {
  const waiting = prs
    .filter((pr) => pr.state === 'open' && !pr.draft && pr.requested_reviewers.length > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const waitHours = waiting.map((pr) =>
    differenceInHours(new Date(), new Date(pr.created_at))
  );
  const medianHours =
    waitHours.length === 0
      ? null
      : waitHours.sort((a, b) => a - b)[Math.floor(waitHours.length / 2)];

  const pressure = new Map<string, { avatar_url: string; pending: number }>();
  for (const pr of waiting) {
    for (const reviewer of pr.requested_reviewers) {
      const current = pressure.get(reviewer.login) ?? { avatar_url: reviewer.avatar_url, pending: 0 };
      current.pending++;
      pressure.set(reviewer.login, current);
    }
  }

  return {
    waitingCount: waiting.length,
    oldestHours: waitHours.length > 0 ? Math.max(...waitHours) : null,
    medianHours,
    overloadedReviewers: Array.from(pressure.entries())
      .map(([login, value]) => ({ login, avatar_url: value.avatar_url, pending: value.pending }))
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 3),
  };
}

export function buildPRAgingBuckets(prs: PullRequest[]): PRAgingBucket[] {
  const buckets: PRAgingBucket[] = [
    { label: '0-1d', count: 0 },
    { label: '2-3d', count: 0 },
    { label: '4-7d', count: 0 },
    { label: '8d+', count: 0 },
  ];

  prs
    .filter((pr) => pr.state === 'open' && !pr.draft)
    .forEach((pr) => {
      const ageDays = differenceInDays(new Date(), new Date(pr.created_at));
      if (ageDays <= 1) buckets[0].count++;
      else if (ageDays <= 3) buckets[1].count++;
      else if (ageDays <= 7) buckets[2].count++;
      else buckets[3].count++;
    });

  return buckets;
}

export function buildReviewLoadImbalance(
  reviewerStats: Array<{ login: string; avatar_url: string; reviewsPending: number; reviewsCompleted: number }>
): ReviewLoadImbalance {
  const totalCompleted = reviewerStats.reduce((sum, reviewer) => sum + reviewer.reviewsCompleted, 0);
  const sortedCompleted = [...reviewerStats].sort((a, b) => b.reviewsCompleted - a.reviewsCompleted);
  const sortedPending = [...reviewerStats]
    .filter((reviewer) => reviewer.reviewsPending > 0)
    .sort((a, b) => b.reviewsPending - a.reviewsPending);

  return {
    topReviewerShare: totalCompleted === 0 ? 0 : Math.round((sortedCompleted[0]?.reviewsCompleted ?? 0) / totalCompleted * 100),
    topPendingReviewer: sortedPending[0]
      ? {
          login: sortedPending[0].login,
          avatar_url: sortedPending[0].avatar_url,
          pending: sortedPending[0].reviewsPending,
        }
      : null,
    topCompletedReviewer: sortedCompleted[0]
      ? {
          login: sortedCompleted[0].login,
          avatar_url: sortedCompleted[0].avatar_url,
          pending: sortedCompleted[0].reviewsCompleted,
        }
      : null,
    activeReviewers: reviewerStats.filter((reviewer) => reviewer.reviewsCompleted > 0 || reviewer.reviewsPending > 0).length,
  };
}

export function buildCollaborationCoverage(
  authorStats: Array<{ login: string; avatar_url: string; prsOpened: number; reviewsGiven: number }>,
  reviewerStats: Array<{ login: string; avatar_url: string; reviewsPending: number }>
): CollaborationCoverage {
  const lowReciprocityAuthors = authorStats
    .filter((author) => author.prsOpened > 0 && author.reviewsGiven / author.prsOpened < 0.5)
    .sort((a, b) => a.reviewsGiven / a.prsOpened - b.reviewsGiven / b.prsOpened)
    .slice(0, 4)
    .map((author) => ({
      login: author.login,
      avatar_url: author.avatar_url,
      prsOpened: author.prsOpened,
      reviewsGiven: author.reviewsGiven,
    }));

  const overloadedReviewers = reviewerStats
    .filter((reviewer) => reviewer.reviewsPending > 0)
    .sort((a, b) => b.reviewsPending - a.reviewsPending)
    .slice(0, 4)
    .map((reviewer) => ({
      login: reviewer.login,
      avatar_url: reviewer.avatar_url,
      pending: reviewer.reviewsPending,
    }));

  return {
    lowReciprocityAuthors,
    overloadedReviewers,
    reviewParticipants: reviewerStats.filter((reviewer) => reviewer.reviewsPending > 0).length,
    authorParticipants: authorStats.filter((author) => author.prsOpened > 0).length,
  };
}

export function buildMergeReadinessBuckets(prs: PullRequest[]): MergeReadinessBucket[] {
  const openPRs = prs.filter((pr) => pr.state === 'open' && !pr.draft);

  return [
    {
      label: 'Ready to merge',
      count: openPRs.filter(
        (pr) => pr.requested_reviewers.length === 0 && pr.ciStatus !== 'failure'
      ).length,
      tone: 'success',
      description: 'No pending review requests and CI not failing',
    },
    {
      label: 'Waiting review',
      count: openPRs.filter((pr) => pr.requested_reviewers.length > 0).length,
      tone: 'warning',
      description: 'Review requests still outstanding',
    },
    {
      label: 'Failing CI',
      count: openPRs.filter((pr) => pr.ciStatus === 'failure').length,
      tone: 'danger',
      description: 'Checks are currently failing',
    },
    {
      label: 'Needs author follow-up',
      count: openPRs.filter(
        (pr) => pr.requested_reviewers.length === 0 && pr.ciStatus === 'pending'
      ).length,
      tone: 'neutral',
      description: 'Not blocked on review, but still in progress',
    },
  ];
}

export function buildFlowStateGraph(
  prs: PullRequest[],
  mergedInWindow: number,
): FlowStateNode[] {
  const openPRs = prs.filter((pr) => pr.state === 'open' && !pr.draft);

  return [
    { label: 'Open', count: openPRs.length, tone: 'brand' },
    {
      label: 'Waiting Review',
      count: openPRs.filter((pr) => pr.requested_reviewers.length > 0).length,
      tone: 'warning',
    },
    {
      label: 'Blocked',
      count: openPRs.filter((pr) => pr.ciStatus === 'failure').length,
      tone: 'danger',
    },
    {
      label: 'Ready',
      count: openPRs.filter((pr) => pr.requested_reviewers.length === 0 && pr.ciStatus !== 'failure').length,
      tone: 'success',
    },
    { label: 'Merged', count: mergedInWindow, tone: 'neutral' },
  ];
}

export function buildRepoHotspots(
  prs: PullRequest[],
  staleDaysThreshold: number
): RepoHotspot[] {
  const byRepo = new Map<string, RepoHotspot>();

  for (const pr of prs.filter((item) => item.state === 'open' && !item.draft)) {
    const repo = pr.repo;
    const current = byRepo.get(repo) ?? {
      repo,
      repoUrl: getRepoUrl(repo),
      waitingReview: 0,
      stale: 0,
      failingCi: 0,
      totalScore: 0,
    };

    if (pr.requested_reviewers.length > 0) current.waitingReview++;
    if (differenceInDays(new Date(), new Date(pr.updated_at)) >= staleDaysThreshold) current.stale++;
    if (pr.ciStatus === 'failure') current.failingCi++;
    current.totalScore = current.waitingReview * 2 + current.stale * 3 + current.failingCi * 2;
    byRepo.set(repo, current);
  }

  return Array.from(byRepo.values())
    .filter((repo) => repo.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 6);
}

export function buildHotspotCascade(
  prs: PullRequest[],
  staleDaysThreshold: number
): HotspotCascadeRepo[] {
  const repoMap = new Map<string, HotspotCascadeRepo>();

  for (const pr of prs.filter((item) => item.state === 'open' && !item.draft)) {
    const repo = pr.repo;
    const current = repoMap.get(repo) ?? {
      repo,
      repoUrl: getRepoUrl(repo),
      total: 0,
      reasons: [
        { label: 'Waiting review', count: 0, tone: 'warning' as const },
        { label: 'Stale', count: 0, tone: 'danger' as const },
        { label: 'Failing CI', count: 0, tone: 'danger' as const },
        { label: 'Large PR', count: 0, tone: 'neutral' as const },
      ],
    };

    let hit = false;
    if (pr.requested_reviewers.length > 0) {
      current.reasons[0].count++;
      hit = true;
    }
    if (differenceInDays(new Date(), new Date(pr.updated_at)) >= staleDaysThreshold) {
      current.reasons[1].count++;
      hit = true;
    }
    if (pr.ciStatus === 'failure') {
      current.reasons[2].count++;
      hit = true;
    }
    if (pr.additions + pr.deletions >= 500) {
      current.reasons[3].count++;
      hit = true;
    }
    if (hit) current.total++;

    repoMap.set(repo, current);
  }

  return Array.from(repoMap.values())
    .map((repo) => ({
      ...repo,
      reasons: repo.reasons.filter((reason) => reason.count > 0),
    }))
    .filter((repo) => repo.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

export function buildReviewDependencyMap(
  prs: PullRequest[]
): ReviewDependencyEdge[] {
  const edges = new Map<string, ReviewDependencyEdge>();

  for (const pr of prs.filter((item) => item.state === 'open' && !item.draft)) {
    const author = pr.user.login;
    for (const reviewer of pr.requested_reviewers) {
      const key = `${author}->${reviewer.login}`;
      const current = edges.get(key) ?? { author, reviewer: reviewer.login, count: 0 };
      current.count++;
      edges.set(key, current);
    }
  }

  return Array.from(edges.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function buildKnowledgeSpread(
  prs: PullRequest[],
  reviews: PRReview[],
): KnowledgeSpreadRow[] {
  const prRepoByKey = new Map<string, string>();
  for (const pr of prs) {
    prRepoByKey.set(`${pr.repo}#${pr.number}`, pr.repo);
  }

  const reviewerRepos = new Map<string, { avatar_url: string; repos: Map<string, number>; reviewsCompleted: number }>();
  for (const review of reviews) {
    const repo = prRepoByKey.get(`${review.repo}#${review.pr_number}`) ?? review.repo;
    const current = reviewerRepos.get(review.user.login) ?? {
      avatar_url: review.user.avatar_url,
      repos: new Map<string, number>(),
      reviewsCompleted: 0,
    };
    current.reviewsCompleted++;
    current.repos.set(repo, (current.repos.get(repo) ?? 0) + 1);
    reviewerRepos.set(review.user.login, current);
  }

  return Array.from(reviewerRepos.entries())
    .map(([login, value]) => {
      const dominantRepoEntry = Array.from(value.repos.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
      return {
        login,
        avatar_url: value.avatar_url,
        reposReviewed: value.repos.size,
        reviewsCompleted: value.reviewsCompleted,
        dominantRepo: dominantRepoEntry ? dominantRepoEntry[0] : null,
        dominantRepoUrl: dominantRepoEntry ? getRepoUrl(dominantRepoEntry[0]) : null,
      };
    })
    .sort((a, b) => {
      if (b.reposReviewed !== a.reposReviewed) return b.reposReviewed - a.reposReviewed;
      return b.reviewsCompleted - a.reviewsCompleted;
    })
    .slice(0, 8);
}

export function buildRepoKnowledgeGraph(
  prs: PullRequest[],
  reviews: PRReview[],
): RepoKnowledgeGraph {
  const prRepoByKey = new Map<string, string>();
  for (const pr of prs) {
    prRepoByKey.set(`${pr.repo}#${pr.number}`, pr.repo);
  }

  const edgeMap = new Map<string, { reviewer: string; repo: string; count: number; avatar_url: string }>();
  for (const review of reviews) {
    const repo = prRepoByKey.get(`${review.repo}#${review.pr_number}`) ?? review.repo;
    const key = `${review.user.login}->${repo}`;
    const current = edgeMap.get(key) ?? {
      reviewer: review.user.login,
      repo,
      count: 0,
      avatar_url: review.user.avatar_url,
    };
    current.count++;
    edgeMap.set(key, current);
  }

  const edges = Array.from(edgeMap.values()).sort((a, b) => b.count - a.count).slice(0, 14);
  const reviewerTotals = new Map<string, { avatar_url: string; total: number }>();
  const repoTotals = new Map<string, number>();

  for (const edge of edges) {
    const reviewer = reviewerTotals.get(edge.reviewer) ?? { avatar_url: edge.avatar_url, total: 0 };
    reviewer.total += edge.count;
    reviewerTotals.set(edge.reviewer, reviewer);
    repoTotals.set(edge.repo, (repoTotals.get(edge.repo) ?? 0) + edge.count);
  }

  return {
    reviewers: Array.from(reviewerTotals.entries()).map(([login, value]) => ({
      id: login,
      label: login,
      avatar_url: value.avatar_url,
      total: value.total,
      side: 'reviewer' as const,
    })),
    repos: Array.from(repoTotals.entries()).map(([repo, total]) => ({
      id: repo,
      label: repo,
      url: getRepoUrl(repo),
      total,
      side: 'repo' as const,
    })),
    edges: edges.map((edge) => ({
      reviewer: edge.reviewer,
      repo: edge.repo,
      count: edge.count,
    })),
  };
}

export function buildHandoffFriction(
  slaHeatmapRows: SLAHeatmapRow[],
): HandoffFrictionRow[] {
  return slaHeatmapRows
    .filter((row) => row.prCount > 0 && (row.firstReviewToApproval !== null || row.approvalToMerge !== null))
    .map((row) => ({
      login: row.login,
      avatar_url: row.avatar_url,
      reviewToApprovalHours: row.firstReviewToApproval,
      approvalToMergeHours: row.approvalToMerge,
      prCount: row.prCount,
    }))
    .sort((a, b) => {
      const aScore = (a.reviewToApprovalHours ?? 0) + (a.approvalToMergeHours ?? 0);
      const bScore = (b.reviewToApprovalHours ?? 0) + (b.approvalToMergeHours ?? 0);
      return bScore - aScore;
    })
    .slice(0, 6);
}

export function buildTeamOperatingModes(
  authorStats: AuthorStats[],
): TeamOperatingModeRow[] {
  return authorStats
    .filter((author) => author.prsOpened > 0 || author.reviewsGiven > 0)
    .map((author) => {
      const reviewRatio = author.prsOpened > 0 ? author.reviewsGiven / author.prsOpened : author.reviewsGiven;
      let mode: TeamOperatingModeRow['mode'] = 'balanced';
      let label = 'Balanced operator';

      if (author.openPRs >= 3) {
        mode = 'backlog-owner';
        label = 'Backlog owner';
      } else if (reviewRatio < 0.5) {
        mode = 'author-heavy';
        label = 'Author-heavy';
      } else if (reviewRatio >= 1.5) {
        mode = 'review-heavy';
        label = 'Review-heavy';
      }

      return {
        login: author.login,
        avatar_url: author.avatar_url,
        mode,
        prsOpened: author.prsOpened,
        reviewsGiven: author.reviewsGiven,
        openPRs: author.openPRs,
        label,
      };
    })
    .sort((a, b) => {
      const weight = (mode: TeamOperatingModeRow['mode']) =>
        mode === 'backlog-owner' ? 3 : mode === 'author-heavy' ? 2 : mode === 'review-heavy' ? 1 : 0;
      const diff = weight(b.mode) - weight(a.mode);
      if (diff !== 0) return diff;
      return (b.prsOpened + b.reviewsGiven) - (a.prsOpened + a.reviewsGiven);
    })
    .slice(0, 8);
}
