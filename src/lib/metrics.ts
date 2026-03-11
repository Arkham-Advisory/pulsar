import type {
  PullRequest,
  PRReview,
  PRMetrics,
  WeeklyDataPoint,
  CycleTimeDataPoint,
  AuthorStats,
  ReviewerStats,
  PRSizeCategory,
} from '../types/github';
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
        reviewsGiven: 0,
        avgCycleTimeHours: null,
      });
    }
    const stats = authorMap.get(login)!;
    stats.prsOpened++;
    if (pr.merged) {
      stats.prsMerged++;
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
        avgResponseHours: null,
        _responseTimes: [],
      });
    }
    if (reviewerMap.has(login)) {
      reviewerMap.get(login)!.reviewsCompleted += reviewList.length;
    }
  }

  return Array.from(reviewerMap.values())
    .map(({ _responseTimes, ...rest }) => rest)
    .sort((a, b) => b.reviewsPending - a.reviewsPending)
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
