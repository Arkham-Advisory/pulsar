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
  body?: string | null;
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
  openPRs: number;
  reviewsGiven: number;
  avgCycleTimeHours: number | null;
  avgTimeToFirstReviewHours: number | null;
}

export interface ReviewerStats {
  login: string;
  avatar_url: string;
  reviewsPending: number;
  reviewsCompleted: number;
  changesRequested: number;
  avgResponseHours: number | null;
}

export interface PRSizeCategory {
  label: string;
  count: number;
  color: string;
}

export interface WeeklyDigest {
  weekLabel: string;
  merges: number;
  prevWeekMerges: number;
  avgCycleTimeHours: number | null;
  openCount: number;
  draftCount: number;
  avgTimeToFirstReviewHours: number | null;
}

export interface HeatmapContributor {
  login: string;
  avatar_url: string;
  // day string "YYYY-MM-DD" → { reviews, merges }
  days: Record<string, { reviews: number; merges: number }>;
  totalActivity: number;
}

export interface BottleneckPhaseData {
  phase: string;
  avgHours: number;
  count: number;
}

export interface SLAHeatmapRow {
  login: string;
  avatar_url: string;
  openToFirstReview: number | null;
  firstReviewToApproval: number | null;
  approvalToMerge: number | null;
  prCount: number;
}

export interface MetricDelta {
  current: number | null;
  previous: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'neutral';
}

export interface TrendSummary {
  merged: MetricDelta;
  cycleTime: MetricDelta;
  timeToFirstReview: MetricDelta;
}

export interface HotspotItem {
  id: string;
  title: string;
  subtitle: string;
  reason: string;
  score: number;
  tone: 'danger' | 'warning' | 'neutral';
  ageLabel: string;
  url: string;
  ownerLogin: string;
  repoLabel: string;
  repoUrl: string;
}

export interface RiskBucket {
  label: string;
  count: number;
  tone: 'danger' | 'warning' | 'neutral';
  description: string;
}

export interface QueueReviewerPressure {
  login: string;
  avatar_url: string;
  pending: number;
}

export interface QueueHealth {
  waitingCount: number;
  oldestHours: number | null;
  medianHours: number | null;
  overloadedReviewers: QueueReviewerPressure[];
}

export interface PRAgingBucket {
  label: string;
  count: number;
}

export interface ReviewLoadImbalance {
  topReviewerShare: number;
  topPendingReviewer: QueueReviewerPressure | null;
  topCompletedReviewer: QueueReviewerPressure | null;
  activeReviewers: number;
}

export interface CollaborationCoverage {
  lowReciprocityAuthors: Array<{
    login: string;
    avatar_url: string;
    prsOpened: number;
    reviewsGiven: number;
  }>;
  overloadedReviewers: QueueReviewerPressure[];
  reviewParticipants: number;
  authorParticipants: number;
}

export interface MergeReadinessBucket {
  label: string;
  count: number;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  description: string;
}

export interface RepoHotspot {
  repo: string;
  repoUrl: string;
  waitingReview: number;
  stale: number;
  failingCi: number;
  totalScore: number;
}

export interface ReviewDependencyEdge {
  author: string;
  reviewer: string;
  count: number;
}

export interface KnowledgeSpreadRow {
  login: string;
  avatar_url: string;
  reposReviewed: number;
  reviewsCompleted: number;
  dominantRepo: string | null;
  dominantRepoUrl: string | null;
}

export interface HandoffFrictionRow {
  login: string;
  avatar_url: string;
  reviewToApprovalHours: number | null;
  approvalToMergeHours: number | null;
  prCount: number;
}

export interface TeamOperatingModeRow {
  login: string;
  avatar_url: string;
  mode: 'balanced' | 'author-heavy' | 'review-heavy' | 'backlog-owner';
  prsOpened: number;
  reviewsGiven: number;
  openPRs: number;
  label: string;
}

export interface FlowStateNode {
  label: string;
  count: number;
  tone: 'brand' | 'warning' | 'danger' | 'success' | 'neutral';
}

export interface HotspotCascadeReason {
  label: string;
  count: number;
  tone: 'warning' | 'danger' | 'neutral';
}

export interface HotspotCascadeRepo {
  repo: string;
  repoUrl: string;
  total: number;
  reasons: HotspotCascadeReason[];
}

export interface RepoKnowledgeNode {
  id: string;
  label: string;
  avatar_url?: string;
  url?: string;
  total: number;
  side: 'reviewer' | 'repo';
}

export interface RepoKnowledgeEdge {
  reviewer: string;
  repo: string;
  count: number;
}

export interface RepoKnowledgeGraph {
  reviewers: RepoKnowledgeNode[];
  repos: RepoKnowledgeNode[];
  edges: RepoKnowledgeEdge[];
}
