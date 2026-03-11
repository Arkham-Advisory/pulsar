import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { capture } from '../lib/analytics';
import { useSettingsStore } from '../store/settings';
import { usePRListData } from '../hooks/usePRListData';
import { useCIStatuses } from '../hooks/useCIStatuses';
import { useApprovalStatuses } from '../hooks/useApprovalStatuses';
import { PRSection } from '../components/pr-list/PRSection';
import { PRDetailPanel } from '../components/pr-list/PRDetailPanel';
import { Spinner } from '../components/ui/Spinner';
import { differenceInHours } from 'date-fns';
import {
  AlertTriangle,
  Eye,
  GitPullRequest,
  GitMerge,
  GitPullRequestDraft,
  Search,
  RefreshCw,
  X,
  ChevronDown,
  Check,
  Bot,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Save,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { PullRequest } from '../types/github';
import type { FilterPreset } from '../types/settings';
import { useQueryClient } from '@tanstack/react-query';

type StateFilter = 'open' | 'merged';

export function PRListPage() {
  const {
    userLogin, repoFilters, staleDaysThreshold,
    selectedRepos, setSelectedRepos,
    hideBotPRs, setHideBotPRs,
    filterPresets, addFilterPreset, removeFilterPreset,
  } = useSettingsStore();
  const { data: prs = [], isLoading, isFetching, progress } = usePRListData();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim()) {
      searchDebounceRef.current = setTimeout(() => {
        capture('filter_changed', { filter_type: 'search' });
      }, 600);
    }
  }, []);
  const [stateFilter, setStateFilter] = useState<StateFilter>('open');
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);

  // Repo dropdown
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  // Preset dropdown
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');
  const presetDropdownRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false);
      }
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setPresetDropdownOpen(false);
        setSaveMode(false);
        setSaveNameInput('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (saveMode) setTimeout(() => saveInputRef.current?.focus(), 50);
  }, [saveMode]);

  // Lazy CI status — kicks off once PR list is loaded
  const { data: ciStatuses } = useCIStatuses(prs, prs.length > 0);
  // Lazy approval/review status — kicks off once PR list is loaded
  const { data: approvalStatuses } = useApprovalStatuses(prs, prs.length > 0);

  // Unique repos for the filter dropdown
  const repos = useMemo(() => {
    const set = new Set(prs.map((p) => p.repo));
    return Array.from(set).sort();
  }, [prs]);

  const showRepoColumn = repoFilters.length > 1 || (repoFilters.length === 1 && repoFilters[0].type !== 'repo');

  // Apply search + state + repo filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prs.filter((pr) => {
      if (stateFilter === 'open' && (pr.state !== 'open' || pr.merged)) return false;
      if (stateFilter === 'merged' && !pr.merged) return false;
      if (selectedRepos.length > 0 && !selectedRepos.includes(pr.repo)) return false;
      if (hideBotPRs && pr.user.login.endsWith('[bot]')) return false;
      if (q) {
        return (
          pr.title.toLowerCase().includes(q) ||
          pr.repo.toLowerCase().includes(q) ||
          pr.user.login.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [prs, search, stateFilter, selectedRepos, hideBotPRs]);

  // Partition into sections
  const { attention, reviewRequested, mine, allOpen, merged, drafts, readyToMerge } = useMemo(() => {
    const attention: PullRequest[] = [];
    const reviewRequested: PullRequest[] = [];
    const mine: PullRequest[] = [];
    const merged: PullRequest[] = [];
    const drafts: PullRequest[] = [];
    const readyToMerge: PullRequest[] = [];

    const placed = new Set<number>();

    const sortByUpdated = (a: PullRequest, b: PullRequest) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

    // Only partition open PRs; merged go to their own section
    const openPRs = filtered.filter((p) => p.state === 'open' && !p.merged);
    const mergedPRs = filtered.filter((p) => p.merged);

    mergedPRs.sort(sortByUpdated);
    merged.push(...mergedPRs);

    // Pass 0 — Ready to merge: approved + CI not failing
    for (const pr of openPRs) {
      if (pr.draft) continue;
      const ci = ciStatuses?.get(pr.id) ?? pr.ciStatus;
      const approval = approvalStatuses?.get(pr.id);
      if (approval === 'approved' && ci !== 'failure') {
        readyToMerge.push(pr);
        placed.add(pr.id);
      }
    }
    readyToMerge.sort(sortByUpdated);

    // Pass 1 — Needs Attention: CI failing or changes requested
    for (const pr of openPRs) {
      if (pr.draft) continue;
      const ci = ciStatuses?.get(pr.id) ?? pr.ciStatus;
      const approval = approvalStatuses?.get(pr.id);
      if (ci === 'failure' || approval === 'changes_requested') {
        attention.push(pr);
        placed.add(pr.id);
      }
    }

    // Also flag: no reviewer, open > stale threshold — only when userLogin is known
    if (userLogin) {
      for (const pr of openPRs) {
        if (placed.has(pr.id) || pr.draft) continue;
        if (
          pr.requested_reviewers.length === 0 &&
          differenceInHours(new Date(), new Date(pr.created_at)) > staleDaysThreshold * 24
        ) {
          attention.push(pr);
          placed.add(pr.id);
        }
      }
    }
    attention.sort(sortByUpdated);

    // Pass 2 — Review requested from me
    for (const pr of openPRs) {
      if (placed.has(pr.id) || pr.draft) continue;
      if (userLogin && pr.requested_reviewers.some((r) => r.login === userLogin)) {
        reviewRequested.push(pr);
        placed.add(pr.id);
      }
    }
    reviewRequested.sort(sortByUpdated);

    // Pass 3 — My open PRs (incl. drafts I authored)
    for (const pr of openPRs) {
      if (placed.has(pr.id)) continue;
      if (userLogin && pr.user.login === userLogin) {
        if (pr.draft) drafts.push(pr);
        else mine.push(pr);
        placed.add(pr.id);
      }
    }
    mine.sort(sortByUpdated);
    drafts.sort(sortByUpdated);

    // All open non-draft PRs (for the All PRs section — superset of all above)
    const allOpen = openPRs.filter((p) => !p.draft).sort(sortByUpdated);

    // Drafts not authored by me
    for (const pr of openPRs) {
      if (placed.has(pr.id) && !drafts.includes(pr)) continue;
      if (pr.draft && !placed.has(pr.id)) {
        drafts.push(pr);
        placed.add(pr.id);
      }
    }

    return { attention, reviewRequested, mine, allOpen, merged, drafts, readyToMerge };
  }, [filtered, ciStatuses, approvalStatuses, userLogin, staleDaysThreshold]);

  const totalOpen = allOpen.length + drafts.length;

  const applyPreset = useCallback((preset: FilterPreset) => {
    setSearch(preset.search);
    setStateFilter(preset.stateFilter);
    setSelectedRepos(preset.selectedRepos);
    setHideBotPRs(preset.hideBotPRs);
    setPresetDropdownOpen(false);
    setSaveMode(false);
  }, [setSelectedRepos, setHideBotPRs]);

  const savePreset = useCallback(() => {
    const name = saveNameInput.trim();
    if (!name) return;
    addFilterPreset({ id: Date.now().toString(), name, search, stateFilter, selectedRepos, hideBotPRs });
    setSaveNameInput('');
    setSaveMode(false);
  }, [saveNameInput, search, stateFilter, selectedRepos, hideBotPRs, addFilterPreset]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search title, repo, author…"
            className="input pl-8 text-sm h-8 py-0"
          />
          {search && (
            <button
              onClick={() => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); setSearch(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* State filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(['open', 'merged'] as StateFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStateFilter(s); capture('filter_changed', { filter_type: 'state', value: s }); }}
              className={cn(
                'text-xs px-3 py-1 rounded-md font-medium transition-colors capitalize',
                stateFilter === s
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Repo multi-select */}
        {repos.length > 1 && (
          <div className="relative shrink-0" ref={repoDropdownRef}>
            <button
              type="button"
              onClick={() => setRepoDropdownOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 input text-xs h-8 py-0 px-3 cursor-pointer select-none',
                selectedRepos.length > 0 && 'ring-2 ring-brand-500'
              )}
            >
              <span>
                {selectedRepos.length === 0
                  ? 'All repos'
                  : selectedRepos.length === 1
                    ? selectedRepos[0].split('/')[1]
                    : `${selectedRepos.length} repos`}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
            </button>
            {repoDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg min-w-80 max-w-[28rem] max-h-72 overflow-y-auto py-1">
                {/* All option */}
                <button
                  type="button"
                  onClick={() => setSelectedRepos([])}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                    selectedRepos.length === 0 ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-slate-600 dark:text-slate-300'
                  )}
                >
                  <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                    {selectedRepos.length === 0 && <Check className="h-3 w-3" />}
                  </span>
                  All repos
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                {repos.map((r) => {
                  const active = selectedRepos.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        const next = active ? selectedRepos.filter((x) => x !== r) : [...selectedRepos, r];
                        setSelectedRepos(next);
                        capture('filter_changed', { filter_type: 'repo', value: next.length });
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                        active ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-slate-600 dark:text-slate-300'
                      )}
                    >
                      <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      {r.split('/')[1]}
                      <span className="ml-auto text-slate-400 font-normal">{r.split('/')[0]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bot filter toggle */}
        <button
          type="button"
          onClick={() => setHideBotPRs(!hideBotPRs)}
          title={hideBotPRs ? 'Show bot PRs' : 'Hide bot PRs (dependabot, renovate, etc.)'}
          className={cn(
            'flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors border shrink-0',
            hideBotPRs
              ? 'bg-brand-50 dark:bg-brand-950/30 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-400'
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400'
          )}
        >
          <Bot className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Bots</span>
        </button>

        {/* Preset dropdown */}
        <div className="relative shrink-0" ref={presetDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setPresetDropdownOpen((v) => !v);
              if (presetDropdownOpen) { setSaveMode(false); setSaveNameInput(''); }
            }}
            title="Filter presets"
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors border shrink-0 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400"
          >
            <Bookmark className="h-3.5 w-3.5" />
            {filterPresets.length > 0 && (
              <span className="hidden sm:inline">{filterPresets.length}</span>
            )}
          </button>
          {presetDropdownOpen && (
            <div className="absolute top-full mt-1 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg w-64 py-1">
              {!saveMode ? (
                <button
                  type="button"
                  onClick={() => setSaveMode(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Save className="h-3.5 w-3.5 text-slate-400" />
                  Save current filters as preset
                </button>
              ) : (
                <div className="px-3 py-2">
                  <input
                    ref={saveInputRef}
                    type="text"
                    value={saveNameInput}
                    onChange={(e) => setSaveNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') savePreset();
                      if (e.key === 'Escape') { setSaveMode(false); setSaveNameInput(''); }
                    }}
                    placeholder="Preset name…"
                    className="input text-xs h-7 py-0 mb-2"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={savePreset}
                      disabled={!saveNameInput.trim()}
                      className="flex-1 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSaveMode(false); setSaveNameInput(''); }}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {filterPresets.length > 0 && (
                <>
                  <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                  {filterPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center gap-1 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                    >
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="flex-1 flex items-start gap-2 text-left min-w-0"
                      >
                        <BookmarkCheck className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{preset.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {[
                              preset.stateFilter,
                              preset.search && `"${preset.search}"`,
                              preset.selectedRepos.length > 0 && `${preset.selectedRepos.length} repo${preset.selectedRepos.length > 1 ? 's' : ''}`,
                              preset.hideBotPRs && 'no bots',
                            ].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFilterPreset(preset.id)}
                        className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete preset"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {filterPresets.length === 0 && !saveMode && (
                <p className="px-3 py-2 text-[11px] text-slate-400 text-center">
                  No presets yet.<br />Set your filters and save them here.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Progress / stats */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {(isLoading || isFetching) && progress ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 max-w-56 truncate">
              <Spinner size="sm" className="h-3 w-3" />
              <span className="truncate">{progress}</span>
            </div>
          ) : !isLoading && (
            <span className="text-xs text-slate-400">{totalOpen} open · {merged.length} merged</span>
          )}
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['pr-list'] })}
            disabled={isFetching}
            className="btn-ghost p-1.5"
            title="Refresh"
          >
            {isFetching ? <Spinner size="sm" className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Spinner size="lg" />
            {progress && <p className="text-sm text-slate-400">{progress}</p>}
          </div>
        ) : prs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <GitPullRequest className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No pull requests found</p>
          </div>
        ) : (
          <div className="p-5 space-y-4 max-w-[1800px] mx-auto">
            {stateFilter === 'merged' ? (
              <PRSection
                id="recently-merged"
                title="Recently Merged"
                icon={<GitMerge className="h-4 w-4" />}
                prs={merged}
                accent="slate"
                defaultOpen
                showRepo={showRepoColumn}
                emptyMessage="No merged PRs in the selected time range"
                onSelectPR={setSelectedPR}
              />
            ) : (
              <>
                {readyToMerge.length > 0 && (
                  <PRSection
                    id="ready-to-merge"
                    title="Ready to Merge"
                    subtitle="Approved · CI passing or neutral"
                    icon={<GitMerge className="h-4 w-4" />}
                    prs={readyToMerge}
                    ciStatuses={ciStatuses}
                    approvalStatuses={approvalStatuses}
                    accent="green"
                    defaultOpen
                    showRepo={showRepoColumn}
                    onSelectPR={setSelectedPR}
                  />
                )}

                <PRSection
                  id="needs-attention"
                  title="Needs Attention"
                  subtitle={`CI failing · changes requested · or no reviewer assigned, open >${staleDaysThreshold}d`}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  prs={attention}
                  ciStatuses={ciStatuses}
                  approvalStatuses={approvalStatuses}
                  accent="red"
                  defaultOpen
                  showRepo={showRepoColumn}
                  emptyMessage="No PRs need attention right now"
                  onSelectPR={setSelectedPR}
                />

                <PRSection
                  id="review-requested"
                  title="Review Requested"
                  icon={<Eye className="h-4 w-4" />}
                  prs={reviewRequested}
                  ciStatuses={ciStatuses}
                  approvalStatuses={approvalStatuses}
                  accent="blue"
                  defaultOpen
                  showRepo={showRepoColumn}
                  emptyMessage="No review requests for you"
                  onSelectPR={setSelectedPR}
                />

                <PRSection
                  id="my-prs"
                  title="My PRs"
                  icon={<GitPullRequest className="h-4 w-4" />}
                  prs={mine}
                  ciStatuses={ciStatuses}
                  approvalStatuses={approvalStatuses}
                  accent="green"
                  defaultOpen
                  showRepo={showRepoColumn}
                  emptyMessage="You have no open pull requests"
                  onSelectPR={setSelectedPR}
                />

                <PRSection
                  id="all-prs"
                  title="All PRs"
                  icon={<GitPullRequest className="h-4 w-4" />}
                  prs={allOpen}
                  ciStatuses={ciStatuses}
                  approvalStatuses={approvalStatuses}
                  accent="slate"
                  defaultOpen={false}
                  showRepo={showRepoColumn}
                  emptyMessage="No other open pull requests"
                  onSelectPR={setSelectedPR}
                />

                {drafts.length > 0 && (
                  <PRSection
                    id="drafts"
                    title="Drafts"
                    icon={<GitPullRequestDraft className="h-4 w-4" />}
                    prs={drafts}
                    ciStatuses={ciStatuses}
                    accent="slate"
                    defaultOpen={false}
                    showRepo={showRepoColumn}
                    onSelectPR={setSelectedPR}
                  />
                )}
              </>
            )}

            <div className="pb-4 text-center text-xs text-slate-400">
              {filtered.length} of {prs.length} pull requests ·{' '}
              {staleDaysThreshold}d stale threshold ·{' '}
              CI status loads lazily for open PRs
            </div>
          </div>
        )}
      </div>

      {/* PR Detail Panel */}
      {selectedPR && (
        <PRDetailPanel
          pr={selectedPR}
          ciStatus={ciStatuses?.get(selectedPR.id)}
          approvalStatus={approvalStatuses?.get(selectedPR.id)}
          onClose={() => setSelectedPR(null)}
        />
      )}
    </div>
  );
}
