import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, RepoFilterEntry } from '../types/settings';
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
      hasValidSettings: () => {
        const { pat, repoFilters } = get();
        return pat.trim().length > 0 && repoFilters.length > 0;
      },
    }),
    {
      name: 'pr-dashboard-settings',
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
      }),
    }
  )
);
