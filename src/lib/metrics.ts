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
} from '../types/github';
import type { SLAPolicy } from '../types/settings';
import {
  format,
  differenceInHours,
  eachWeekOfInterval,
  isWithinInterval,
  startOfDay,
  addWeeks,
} from 'date-fns';

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

// Get since date from time range
export function getSinceDate(timeRange: string): Date {
  const now = new Date();
  const days = parseInt(timeRange);
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  return startOfDay(since);
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
