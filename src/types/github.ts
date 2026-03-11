export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
}

export type PRState = 'open' | 'closed' | 'merged';

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  repo: string; // full_name
  additions: number;
  deletions: number;
  changed_files: number;
  review_comments: number;
  comments: number;
  commits: number;
  draft: boolean;
  requested_reviewers: GitHubUser[];
  assignees: GitHubUser[];
  base: { ref: string };
  head: { ref: string; sha: string };
  ciStatus: 'success' | 'failure' | 'pending' | 'neutral' | 'unknown';
}

export interface PRReview {
  id: number;
  user: GitHubUser;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  submitted_at: string;
  pr_number: number;
  repo: string;
}

export interface PRMetrics {
  total: number;
  open: number;
  merged: number;
  closed: number;
  draft: number;
  stale: number; // open > staleDays
  waitingReview: number;
  avgCycleTimeHours: number | null;
  avgTimeToFirstReviewHours: number | null;
  avgPRSize: number;
  mergeRate: number; // merged / (merged + closed) %
}

export type TimeRange = '7d' | '14d' | '30d' | '60d' | '90d';

export interface WeeklyDataPoint {
  week: string; // ISO week label e.g. "Mon Mar 4"
  opened: number;
  merged: number;
  closed: number;
}

export interface CycleTimeDataPoint {
  week: string;
  avgHours: number;
  count: number;
}

export interface AuthorStats {
  login: string;
  avatar_url: string;
  prsOpened: number;
  prsMerged: number;
  reviewsGiven: number;
  avgCycleTimeHours: number | null;
}

export interface ReviewerStats {
  login: string;
  avatar_url: string;
  reviewsPending: number;
  reviewsCompleted: number;
  avgResponseHours: number | null;
}

export interface PRSizeCategory {
  label: string;
  count: number;
  color: string;
}
