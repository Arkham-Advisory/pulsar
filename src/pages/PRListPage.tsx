import { useMemo, useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '../store/settings';
import { usePRListData } from '../hooks/usePRListData';
import { useCIStatuses } from '../hooks/useCIStatuses';
import { useApprovalStatuses } from '../hooks/useApprovalStatuses';
import { PRSection } from '../components/pr-list/PRSection';
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
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { PullRequest } from '../types/github';
import { useQueryClient } from '@tanstack/react-query';

type StateFilter = 'open' | 'merged';

export function PRListPage() {
  const { userLogin, repoFilters, staleDaysThreshold, selectedRepos, setSelectedRepos } = useSettingsStore();
  const { data: prs = [], isLoading, isFetching, progress } = usePRListData();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('open');
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
      if (q) {
        return (
          pr.title.toLowerCase().includes(q) ||
          pr.repo.toLowerCase().includes(q) ||
          pr.user.login.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [prs, search, stateFilter, selectedRepos]);

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

    // Pass 1 — Needs Attention: CI failing
    for (const pr of openPRs) {
      if (pr.draft) continue;
      const ci = ciStatuses?.get(pr.id) ?? pr.ciStatus;
      if (ci === 'failure') {
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

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, repo, author…"
            className="input pl-8 text-sm h-8 py-0"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
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
              onClick={() => setStateFilter(s)}
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
          <div className="relative" ref={repoDropdownRef}>
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
                        setSelectedRepos(
                          active
                            ? selectedRepos.filter((x) => x !== r)
                            : [...selectedRepos, r]
                        );
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
                  />
                )}

                <PRSection
                  id="needs-attention"
                  title="Needs Attention"
                  subtitle={`CI failing · or no reviewer assigned, open >${staleDaysThreshold}d`}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  prs={attention}
                  ciStatuses={ciStatuses}
                  approvalStatuses={approvalStatuses}
                  accent="red"
                  defaultOpen
                  showRepo={showRepoColumn}
                  emptyMessage={`No PRs need attention right now`}
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
                  />
                )}
              </>
            )}

            <div className="pb-4 text-center text-xs text-slate-400">
              {filtered.length} of {prs.length} pull requests ·
              {' '}
              {staleDaysThreshold}d stale threshold ·
              CI status loads lazily for open PRs
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
