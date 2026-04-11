import type { PullRequest } from './github';
import type { FilterPreset } from './settings';

export type CommandGroupId = 'navigation' | 'actions' | 'filters' | 'presets' | 'pull_requests';

export interface CommandItem {
  id: string;
  group: CommandGroupId;
  title: string;
  subtitle?: string;
  keywords?: string[];
  perform: (query: string) => void;
}

export interface PRListCommandBridge {
  search: string;
  stateFilter: 'open' | 'merged';
  selectedRepos: string[];
  selectedReviewers: string[];
  hideBotPRs: boolean;
  repos: string[];
  reviewers: string[];
  filterPresets: FilterPreset[];
  visiblePRs: PullRequest[];
  setSearch: (value: string) => void;
  setStateFilter: (value: 'open' | 'merged') => void;
  setSingleRepo: (repo: string) => void;
  setSingleReviewer: (reviewer: string) => void;
  toggleHideBotPRs: () => void;
  clearFilters: () => void;
  applyPreset: (presetId: string) => void;
  openPR: (prId: number) => void;
  copyShareLink: () => void;
}
