import type { TimeRange } from './github';

/**
 * org    – track ALL repos under an org/user
 * prefix – track repos whose name starts with a given prefix
 * repo   – track a single specific repo
 */
export type RepoFilterEntry =
  | { id: string; type: 'org';    owner: string }
  | { id: string; type: 'prefix'; owner: string; prefix: string }
  | { id: string; type: 'repo';   owner: string; repo: string };

export interface FilterPreset {
  id: string;
  name: string;
  search: string;
  stateFilter: 'open' | 'merged';
  selectedRepos: string[];
  hideBotPRs: boolean;
  selectedReviewers: string[];
}

export interface SLAPolicy {
  /** Max hours from PR open to first review */
  firstReviewHours: number;
  /** Max hours from first review to approval */
  approvalHours: number;
  /** Max hours from approval to merge */
  mergeHours: number;
}

export interface IssueTrackerConfig {
  id: string;
  name: string;
  /** github → auto-links #N; jira → links KEY-N; custom → user-defined regex */
  type: 'github' | 'jira' | 'custom';
  /** Base URL, e.g. https://company.atlassian.net */
  baseUrl: string;
  /** Jira only: project key prefix, e.g. "PRJ" */
  projectKey?: string;
  /** Custom only: regex pattern with one capture group */
  pattern?: string;
  /** Custom only: URL template using {{key}} placeholder */
  urlTemplate?: string;
}

export interface Settings {
  pat: string;
  userLogin: string;
  selectedRepos: string[];
  repoFilters: RepoFilterEntry[];
  timeRange: TimeRange;
  staleDaysThreshold: number;
  darkMode: boolean;
  refreshIntervalMinutes: number;
  sectionOpen: Record<string, boolean>;
  analyticsConsent: boolean | null; // null = undecided (show prompt)
  hideBotPRs: boolean;
  filterPresets: FilterPreset[];
  pinnedPRs: string[]; // "owner/repo#number"
  sectionOrder: string[];
  slaPolicy: SLAPolicy;
  issueTrackers: IssueTrackerConfig[];
}

export const DEFAULT_SETTINGS: Settings = {
  pat: '',
  userLogin: '',
  selectedRepos: [],
  repoFilters: [],
  timeRange: '30d',
  staleDaysThreshold: 7,
  darkMode: true,
  refreshIntervalMinutes: 5,
  sectionOpen: {},
  analyticsConsent: null,
  hideBotPRs: false,
  filterPresets: [],
  pinnedPRs: [],
  sectionOrder: ['my-turn', 'ready-to-merge', 'needs-attention', 'review-requested', 'my-prs', 'all-prs', 'drafts'],
  slaPolicy: { firstReviewHours: 4, approvalHours: 24, mergeHours: 48 },
  issueTrackers: [],
};

