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
  sectionOrder: ['ready-to-merge', 'needs-attention', 'review-requested', 'my-prs', 'all-prs', 'drafts'],
};

