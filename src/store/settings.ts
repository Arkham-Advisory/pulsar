import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, RepoFilterEntry, FilterPreset, SLAPolicy, IssueTrackerConfig } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { TimeRange } from '../types/github';

interface SettingsStore extends Settings {
  setPat: (pat: string) => void;
  setUserLogin: (login: string) => void;
  setSelectedRepos: (repos: string[]) => void;
  setRepoFilters: (filters: RepoFilterEntry[]) => void;
  addRepoFilter: (filter: RepoFilterEntry) => void;
  removeRepoFilter: (id: string) => void;
  setTimeRange: (range: TimeRange) => void;
  setStaleDaysThreshold: (days: number) => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setRefreshInterval: (minutes: number) => void;
  setSectionOpen: (id: string, open: boolean) => void;
  setAnalyticsConsent: (consent: boolean) => void;
  setHideBotPRs: (hide: boolean) => void;
  addFilterPreset: (preset: FilterPreset) => void;
  removeFilterPreset: (id: string) => void;
  pinPR: (key: string) => void;
  unpinPR: (key: string) => void;
  setSectionOrder: (order: string[]) => void;
  setSLAPolicy: (policy: SLAPolicy) => void;
  addIssueTracker: (tracker: IssueTrackerConfig) => void;
  removeIssueTracker: (id: string) => void;
  updateIssueTracker: (id: string, update: Partial<IssueTrackerConfig>) => void;
  hasValidSettings: () => boolean;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      setPat: (pat) => set({ pat }),
      setUserLogin: (userLogin) => set({ userLogin }),
      setSelectedRepos: (selectedRepos) => set({ selectedRepos }),
      setRepoFilters: (repoFilters) => set({ repoFilters }),
      addRepoFilter: (filter) =>
        set((state) => ({
          repoFilters: [...state.repoFilters, filter],
        })),
      removeRepoFilter: (id) =>
        set((state) => ({
          repoFilters: state.repoFilters.filter((f) => f.id !== id),
        })),
      setTimeRange: (timeRange) => set({ timeRange }),
      setStaleDaysThreshold: (staleDaysThreshold) => set({ staleDaysThreshold }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setDarkMode: (darkMode) => set({ darkMode }),
      setRefreshInterval: (refreshIntervalMinutes) => set({ refreshIntervalMinutes }),
      setSectionOpen: (id, open) =>
        set((state) => ({ sectionOpen: { ...state.sectionOpen, [id]: open } })),
      setAnalyticsConsent: (analyticsConsent) => set({ analyticsConsent }),
      setHideBotPRs: (hideBotPRs) => set({ hideBotPRs }),
      addFilterPreset: (preset) =>
        set((state) => ({ filterPresets: [...state.filterPresets, preset] })),
      removeFilterPreset: (id) =>
        set((state) => ({ filterPresets: state.filterPresets.filter((p) => p.id !== id) })),
      pinPR: (key) =>
        set((state) => ({
          pinnedPRs: state.pinnedPRs.includes(key) ? state.pinnedPRs : [...state.pinnedPRs, key],
        })),
      unpinPR: (key) =>
        set((state) => ({ pinnedPRs: state.pinnedPRs.filter((k) => k !== key) })),
      setSectionOrder: (sectionOrder) => set({ sectionOrder }),
      setSLAPolicy: (slaPolicy) => set({ slaPolicy }),
      addIssueTracker: (tracker) =>
        set((state) => ({ issueTrackers: [...state.issueTrackers, tracker] })),
      removeIssueTracker: (id) =>
        set((state) => ({ issueTrackers: state.issueTrackers.filter((t) => t.id !== id) })),
      updateIssueTracker: (id, update) =>
        set((state) => ({
          issueTrackers: state.issueTrackers.map((t) => (t.id === id ? { ...t, ...update } : t)),
        })),
      hasValidSettings: () => {
        const { pat, repoFilters } = get();
        return pat.trim().length > 0 && repoFilters.length > 0;
      },
    }),
    {
      name: 'pr-dashboard-settings',
      // Ensure new fields added to DEFAULT_SETTINGS are always present after rehydration
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        // Re-apply defaults for any fields missing from the persisted snapshot
        slaPolicy: (persisted as Partial<Settings>).slaPolicy ?? DEFAULT_SETTINGS.slaPolicy,
        issueTrackers: (persisted as Partial<Settings>).issueTrackers ?? DEFAULT_SETTINGS.issueTrackers,
        sectionOrder: (persisted as Partial<Settings>).sectionOrder ?? DEFAULT_SETTINGS.sectionOrder,
      }),
      // Isolate PAT in localStorage under a specific key
      partialize: (state) => ({
        pat: state.pat,
        userLogin: state.userLogin,
        selectedRepos: state.selectedRepos,
        repoFilters: state.repoFilters,
        timeRange: state.timeRange,
        staleDaysThreshold: state.staleDaysThreshold,
        darkMode: state.darkMode,
        refreshIntervalMinutes: state.refreshIntervalMinutes,
        sectionOpen: state.sectionOpen,
        analyticsConsent: state.analyticsConsent,
        hideBotPRs: state.hideBotPRs,
        filterPresets: state.filterPresets,
        pinnedPRs: state.pinnedPRs,
        sectionOrder: state.sectionOrder,
        slaPolicy: state.slaPolicy,
        issueTrackers: state.issueTrackers,
      }),
    }
  )
);
