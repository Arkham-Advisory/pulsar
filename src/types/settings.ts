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

export interface Settings {
  pat: string;
  userLogin: string;
  selectedRepos: string[];
  repoFilters: RepoFilterEntry[];
  timeRange: TimeRange;
  staleDaysThreshold: number;
  darkMode: boolean;
  refreshIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  pat: '',
  userLogin: '',
  selectedRepos: [],
  repoFilters: [],
  timeRange: '30d',
  staleDaysThreshold: 7,
  darkMode: true,
  refreshIntervalMinutes: 15,
};

