import { useMemo, useState, useRef, useEffect, useCallback, type CSSProperties, type ReactElement } from 'react';
import { capture } from '../lib/analytics';
import { useSettingsStore } from '../store/settings';
import { usePRListData } from '../hooks/usePRListData';
import { useCIStatuses } from '../hooks/useCIStatuses';
import { useApprovalStatuses } from '../hooks/useApprovalStatuses';
import { useConflictStatuses } from '../hooks/useConflictStatuses';
import { PRSection } from '../components/pr-list/PRSection';
import { PRDetailPanel } from '../components/pr-list/PRDetailPanel';
import { SharedLinkBanner } from '../components/pr-list/SharedLinkBanner';
import {
  SharedLinkPreviewModal,
  type SharedLinkPayload,
} from '../components/pr-list/SharedLinkPreviewModal';
import { Spinner } from '../components/ui/Spinner';
import { checkRepoFilterAccess, type ApprovalStatus } from '../services/github';
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
  Share2,
  Pin,
  Users,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { PullRequest } from '../types/github';
import type { FilterPreset, RepoFilterEntry } from '../types/settings';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type StateFilter = 'open' | 'merged';

const DEFAULT_SECTION_ORDER = [
  'ready-to-merge', 'needs-attention', 'review-requested', 'my-prs', 'all-prs', 'drafts',
] as const;

interface SectionDef {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactElement;
  prs: PullRequest[];
  accent: 'red' | 'amber' | 'green' | 'blue' | 'slate' | 'brand';
  defaultOpen?: boolean;
  emptyMessage?: string;
}

interface SortablePRSectionProps {
  section: SectionDef;
  ciStatuses?: Map<number, PullRequest['ciStatus']>;
  approvalStatuses?: Map<number, ApprovalStatus>;
  conflictStatuses?: Map<number, boolean>;
  sizeTotals?: Map<number, number>;
  showRepo: boolean;
  onSelectPR: (pr: PullRequest) => void;
  pinnedPRs: string[];
  onTogglePin: (pr: PullRequest) => void;
}

function SortablePRSection({
  section,
  ciStatuses,
  approvalStatuses,
  conflictStatuses,
  sizeTotals,
  showRepo,
  onSelectPR,
  pinnedPRs,
  onTogglePin,
}: SortablePRSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <PRSection
        id={section.id}
        title={section.title}
        subtitle={section.subtitle}
        icon={section.icon}
        prs={section.prs}
        ciStatuses={ciStatuses}
        approvalStatuses={approvalStatuses}
        conflictStatuses={conflictStatuses}
        sizeTotals={sizeTotals}
        accent={section.accent}
        defaultOpen={section.defaultOpen}
        showRepo={showRepo}
        emptyMessage={section.emptyMessage}
        onSelectPR={onSelectPR}
        pinnedPRs={pinnedPRs}
        onTogglePin={onTogglePin}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  );
}

interface SharedLinkState {
  incoming: RepoFilterEntry[];
  status: 'pending' | 'checking' | 'done';
  accessible: RepoFilterEntry[];
  inaccessible: RepoFilterEntry[];
  replaceRepoFilters?: boolean;
}

interface Props {
  onOpenSettings?: () => void;
}

export function PRListPage({ onOpenSettings }: Props) {
  const {
    pat,
    userLogin, repoFilters, staleDaysThreshold,
    setSelectedRepos: storeSetSelectedRepos,
    setHideBotPRs: storeSetHideBotPRs,
    setRepoFilters: storeSetRepoFilters,
    filterPresets, addFilterPreset, removeFilterPreset,
    pinnedPRs, pinPR, unpinPR,
    addRepoFilter,
    setSectionOrder: storeSetSectionOrder,
  } = useSettingsStore();

  // ── Tab-local filter state ─────────────────────────────────────────────────
  // Each tab gets its own isolated copy initialised from saved defaults.
  // Changes are written back to the store so future new tabs inherit them,
  // but already-open tabs keep their own state — making share links work cleanly.
  const [selectedRepos, setSelectedReposLocal] = useState<string[]>(
    () => useSettingsStore.getState().selectedRepos,
  );
  const [hideBotPRs, setHideBotPRsLocal] = useState<boolean>(
    () => useSettingsStore.getState().hideBotPRs,
  );
  const [sectionOrder, setSectionOrderLocal] = useState<string[]>(
    () => useSettingsStore.getState().sectionOrder,
  );

  const setSelectedRepos = useCallback((repos: string[]) => {
    setSelectedReposLocal(repos);
    storeSetSelectedRepos(repos);
  }, [storeSetSelectedRepos]);

  const setHideBotPRs = useCallback((hide: boolean) => {
    setHideBotPRsLocal(hide);
    storeSetHideBotPRs(hide);
  }, [storeSetHideBotPRs]);

  const setSectionOrder = useCallback((order: string[]) => {
    setSectionOrderLocal(order);
    storeSetSectionOrder(order);
  }, [storeSetSectionOrder]);
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
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [sharedLink, setSharedLink] = useState<SharedLinkState | null>(null);
  const [sharedLinkPayload, setSharedLinkPayload] = useState<SharedLinkPayload | null>(null);

  // ── Shareable URL ──────────────────────────────────────────────────────────
  // Read filter from hash on first render
  const didReadHash = useRef(false);

  // Helper to parse a hash string and set shared-link modal state if applicable.
  // Returns true if the hash contained a share link (modal was triggered).
  const parseSharedHash = useCallback((hash: string): boolean => {
    if (!hash.startsWith('#filter=')) return false;
    try {
      const raw = JSON.parse(atob(hash.slice(8)));
      if (raw.share === true) {
        setSharedLinkPayload(raw as SharedLinkPayload);
        return true;
      }
    } catch { /* ignore malformed hash */ }
    return false;
  }, []);

  useEffect(() => {
    if (didReadHash.current) return;
    const hash = window.location.hash;
    if (parseSharedHash(hash)) {
      // Share link detected — keep didReadHash false so the hash-write effect
      // doesn't race and clear the URL before the modal is shown.
      // didReadHash is set to true inside handleApplySharedLink / dismiss handlers.
      return;
    }
    // Non-share hash — mark as read immediately so the write effect can take over.
    didReadHash.current = true;
    if (!hash.startsWith('#filter=')) return;
    try {
      const raw = JSON.parse(atob(hash.slice(8)));
      // Own-tab hash — restore state quietly
      if (typeof raw.search === 'string') setSearch(raw.search);
      if (raw.stateFilter === 'open' || raw.stateFilter === 'merged') setStateFilter(raw.stateFilter);
      if (Array.isArray(raw.selectedRepos)) setSelectedRepos(raw.selectedRepos);
      if (typeof raw.hideBotPRs === 'boolean') setHideBotPRs(raw.hideBotPRs);
      if (Array.isArray(raw.selectedReviewers)) setSelectedReviewers(raw.selectedReviewers);
      if (Array.isArray(raw.sectionOrder) && (raw.sectionOrder as unknown[]).every((v) => typeof v === 'string')) {
        setSectionOrder(raw.sectionOrder as string[]);
      }
    } catch { /* ignore malformed hash */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for hash changes triggered by same-tab navigation (e.g. pasting a share URL in the
  // address bar without a full page reload). Full-page reloads are handled by the mount effect above.
  useEffect(() => {
    const handleHashChange = () => {
      parseSharedHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [parseSharedHash]);

  // Apply a shared link payload (called from SharedLinkPreviewModal)
  const handleApplySharedLink = useCallback((payload: SharedLinkPayload, replaceRepoFilters: boolean) => {
    if (typeof payload.search === 'string') setSearch(payload.search);
    if (payload.stateFilter === 'open' || payload.stateFilter === 'merged') setStateFilter(payload.stateFilter);
    if (Array.isArray(payload.selectedRepos)) setSelectedRepos(payload.selectedRepos);
    if (typeof payload.hideBotPRs === 'boolean') setHideBotPRs(payload.hideBotPRs);
    if (Array.isArray(payload.selectedReviewers)) setSelectedReviewers(payload.selectedReviewers);
    if (Array.isArray(payload.sectionOrder) && payload.sectionOrder.every((v: unknown) => typeof v === 'string')) {
      setSectionOrder(payload.sectionOrder as string[]);
    }
    if (Array.isArray(payload.repoFilters) && payload.repoFilters.length > 0) {
      setSharedLink({
        incoming: payload.repoFilters as RepoFilterEntry[],
        status: 'pending',
        accessible: [],
        inaccessible: [],
        replaceRepoFilters,
      });
    }
    setSharedLinkPayload(null);
    // Now that the share link has been acted on, let the hash-write effect take over.
    didReadHash.current = true;
    history.replaceState(null, '', window.location.pathname + window.location.search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSelectedRepos, setHideBotPRs, setSectionOrder]);

  // When a PAT is available and there are pending shared repo configs, check access
  useEffect(() => {
    if (!sharedLink || sharedLink.status !== 'pending') return;
    if (!pat) return; // banner prompts user to add PAT first

    // Filter to only truly new entries (not already in the user's config)
    const newFilters = sharedLink.incoming.filter((entry) =>
      !repoFilters.some((f) => {
        if (f.type !== entry.type || f.owner !== entry.owner) return false;
        if (f.type === 'repo' && entry.type === 'repo') return f.repo === entry.repo;
        if (f.type === 'prefix' && entry.type === 'prefix') return f.prefix === entry.prefix;
        return true; // org
      }),
    );

    if (newFilters.length === 0) {
      setSharedLink(null); // everything already configured, nothing to do
      return;
    }

    setSharedLink((prev) => (prev ? { ...prev, status: 'checking' } : null));

    Promise.all(
      newFilters.map(async (entry) => {
        const ok = await checkRepoFilterAccess(pat, entry);
        return { entry, ok };
      }),
    ).then((results) => {
      const accessible = results.filter((r) => r.ok).map((r) => r.entry);
      const inaccessible = results.filter((r) => !r.ok).map((r) => r.entry);
      // Add or replace repo sources with fresh local IDs
      if (sharedLink.replaceRepoFilters) {
        storeSetRepoFilters(accessible.map((entry) => ({ ...entry, id: crypto.randomUUID() })));
      } else {
        accessible.forEach((entry) => addRepoFilter({ ...entry, id: crypto.randomUUID() }));
      }
      setSharedLink((prev) => (prev ? { ...prev, status: 'done', accessible, inaccessible } : null));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedLink?.status, pat]);

  // Write filter to hash whenever it changes.
  // Skip while a shared-link modal is open (don't overwrite the incoming share hash
  // before the user has accepted or dismissed it).
  useEffect(() => {
    if (!didReadHash.current) return;
    if (sharedLinkPayload) return; // preserve share hash during review
    const isDefaultOrder = sectionOrder.length === DEFAULT_SECTION_ORDER.length &&
      sectionOrder.every((id, i) => id === DEFAULT_SECTION_ORDER[i]);
    const isDefault = !search && stateFilter === 'open' && selectedRepos.length === 0 && !hideBotPRs && selectedReviewers.length === 0 && isDefaultOrder;
    if (isDefault) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      const payload: Record<string, unknown> = { search, stateFilter, selectedRepos, hideBotPRs, selectedReviewers };
      if (!isDefaultOrder) payload.sectionOrder = sectionOrder;
      const encoded = btoa(JSON.stringify(payload));
      history.replaceState(null, '', `#filter=${encoded}`);
    }
  }, [search, stateFilter, selectedRepos, hideBotPRs, selectedReviewers, sectionOrder, sharedLinkPayload]);

  const [copyLinkToast, setCopyLinkToast] = useState(false);
  // Share button produces a full link that includes the sender's repo configurations
  const handleCopyLink = useCallback(() => {
    const isDefaultOrder = sectionOrder.length === DEFAULT_SECTION_ORDER.length &&
      sectionOrder.every((id, i) => id === DEFAULT_SECTION_ORDER[i]);
    const payload: Record<string, unknown> = { share: true, search, stateFilter, selectedRepos, hideBotPRs, selectedReviewers };
    if (repoFilters.length > 0) payload.repoFilters = repoFilters;
    if (!isDefaultOrder) payload.sectionOrder = sectionOrder;
    const encoded = btoa(JSON.stringify(payload));
    const url = `${window.location.origin}${window.location.pathname}#filter=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyLinkToast(true);
      setTimeout(() => setCopyLinkToast(false), 2000);
    });
  }, [search, stateFilter, selectedRepos, hideBotPRs, selectedReviewers, repoFilters, sectionOrder]);

  // Repo dropdown
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  // Reviewer dropdown
  const [reviewerDropdownOpen, setReviewerDropdownOpen] = useState(false);
  const reviewerDropdownRef = useRef<HTMLDivElement>(null);

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
      if (reviewerDropdownRef.current && !reviewerDropdownRef.current.contains(e.target as Node)) {
        setReviewerDropdownOpen(false);
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
  // Lazy conflict detection + size data — one pulls.get batch covers both
  const { data: prDetails } = useConflictStatuses(prs, prs.length > 0);
  const conflictStatuses = prDetails?.conflicts;
  const sizeTotals = prDetails?.sizeTotals;

  // Unique repos for the filter dropdown
  const repos = useMemo(() => {
    const set = new Set(prs.map((p) => p.repo));
    return Array.from(set).sort();
  }, [prs]);

  // Unique requested reviewers across all open PRs
  const allReviewers = useMemo(() => {
    const set = new Set<string>();
    prs.forEach((pr) => pr.requested_reviewers.forEach((r) => set.add(r.login)));
    return Array.from(set).sort();
  }, [prs]);

  const showRepoColumn = repoFilters.length > 1 || (repoFilters.length === 1 && repoFilters[0].type !== 'repo');

  // Apply search + state + repo + reviewer filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prs.filter((pr) => {
      if (stateFilter === 'open' && (pr.state !== 'open' || pr.merged)) return false;
      if (stateFilter === 'merged' && !pr.merged) return false;
      if (selectedRepos.length > 0 && !selectedRepos.includes(pr.repo)) return false;
      if (hideBotPRs && pr.user.login.endsWith('[bot]')) return false;
      if (selectedReviewers.length > 0 && !pr.requested_reviewers.some((r) => selectedReviewers.includes(r.login))) return false;
      if (q) {
        return (
          pr.title.toLowerCase().includes(q) ||
          pr.repo.toLowerCase().includes(q) ||
          pr.user.login.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [prs, search, stateFilter, selectedRepos, hideBotPRs, selectedReviewers]);

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

    // Also flag: file conflicts with another open PR in the same repo
    if (conflictStatuses) {
      for (const pr of openPRs) {
        if (placed.has(pr.id) || pr.draft) continue;
        if (conflictStatuses.has(pr.id)) {
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
    // Always shown here even if already placed in another section (e.g. Needs Attention)
    for (const pr of openPRs) {
      if (userLogin && pr.user.login === userLogin) {
        if (pr.draft) { if (!drafts.includes(pr)) drafts.push(pr); }
        else { if (!mine.includes(pr)) mine.push(pr); }
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
  }, [filtered, ciStatuses, approvalStatuses, conflictStatuses, userLogin, staleDaysThreshold]);

  const totalOpen = allOpen.length + drafts.length;

  // Pinned PRs — resolved from the full prs list by key "owner/repo#number"
  const pinnedList = useMemo(() => {
    const keySet = new Set(pinnedPRs);
    return prs.filter((pr) => keySet.has(`${pr.repo}#${pr.number}`));
  }, [prs, pinnedPRs]);

  const handleTogglePin = useCallback((pr: PullRequest) => {
    const key = `${pr.repo}#${pr.number}`;
    if (pinnedPRs.includes(key)) unpinPR(key);
    else pinPR(key);
  }, [pinnedPRs, pinPR, unpinPR]);

  // Drag-and-drop section reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSectionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(String(active.id));
    const newIndex = sectionOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setSectionOrder(arrayMove(sectionOrder, oldIndex, newIndex));
    capture('section_reordered', { from: String(active.id), to: String(over.id) });
  }, [sectionOrder, setSectionOrder]);

  const sectionDefs = useMemo((): SectionDef[] => [
    {
      id: 'ready-to-merge',
      title: 'Ready to Merge',
      subtitle: 'Approved · CI passing or neutral',
      icon: <GitMerge className="h-4 w-4" />,
      prs: readyToMerge,
      accent: 'green',
      defaultOpen: true,
    },
    {
      id: 'needs-attention',
      title: 'Needs Attention',
      subtitle: `CI failing · changes requested · file conflicts · or no reviewer >${staleDaysThreshold}d`,
      icon: <AlertTriangle className="h-4 w-4" />,
      prs: attention,
      accent: 'red',
      defaultOpen: true,
      emptyMessage: 'No PRs need attention right now',
    },
    {
      id: 'review-requested',
      title: 'Review Requested',
      icon: <Eye className="h-4 w-4" />,
      prs: reviewRequested,
      accent: 'blue',
      defaultOpen: true,
      emptyMessage: 'No review requests for you',
    },
    {
      id: 'my-prs',
      title: 'My PRs',
      icon: <GitPullRequest className="h-4 w-4" />,
      prs: mine,
      accent: 'green',
      defaultOpen: true,
      emptyMessage: 'You have no open pull requests',
    },
    {
      id: 'all-prs',
      title: 'All PRs',
      icon: <GitPullRequest className="h-4 w-4" />,
      prs: allOpen,
      accent: 'slate',
      defaultOpen: false,
      emptyMessage: 'No other open pull requests',
    },
    {
      id: 'drafts',
      title: 'Drafts',
      icon: <GitPullRequestDraft className="h-4 w-4" />,
      prs: drafts,
      accent: 'slate',
      defaultOpen: false,
    },
  ], [readyToMerge, attention, reviewRequested, mine, allOpen, drafts, staleDaysThreshold]);

  const orderedSectionDefs = useMemo(() => {
    return [...sectionDefs].sort((a, b) => {
      const aIdx = sectionOrder.indexOf(a.id);
      const bIdx = sectionOrder.indexOf(b.id);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
  }, [sectionDefs, sectionOrder]);

  const applyPreset = useCallback((preset: FilterPreset) => {
    setSearch(preset.search);
    setStateFilter(preset.stateFilter);
    setSelectedRepos(preset.selectedRepos);
    setHideBotPRs(preset.hideBotPRs);
    setSelectedReviewers(preset.selectedReviewers ?? []);
    setPresetDropdownOpen(false);
    setSaveMode(false);
  }, [setSelectedRepos, setHideBotPRs]);

  const savePreset = useCallback(() => {
    const name = saveNameInput.trim();
    if (!name) return;
    addFilterPreset({ id: Date.now().toString(), name, search, stateFilter, selectedRepos, hideBotPRs, selectedReviewers });
    setSaveNameInput('');
    setSaveMode(false);
  }, [saveNameInput, search, stateFilter, selectedRepos, hideBotPRs, selectedReviewers, addFilterPreset]);

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

        {/* Reviewer multi-select */}
        {allReviewers.length > 0 && (
          <div className="relative shrink-0" ref={reviewerDropdownRef}>
            <button
              type="button"
              onClick={() => setReviewerDropdownOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 input text-xs h-8 py-0 px-3 cursor-pointer select-none',
                selectedReviewers.length > 0 && 'ring-2 ring-brand-500'
              )}
            >
              <Users className="h-3 w-3 text-slate-400 shrink-0" />
              <span>
                {selectedReviewers.length === 0
                  ? 'All reviewers'
                  : selectedReviewers.length === 1
                    ? selectedReviewers[0]
                    : `${selectedReviewers.length} reviewers`}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
            </button>
            {reviewerDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg min-w-52 max-w-xs max-h-72 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => setSelectedReviewers([])}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                    selectedReviewers.length === 0 ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-slate-600 dark:text-slate-300'
                  )}
                >
                  <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                    {selectedReviewers.length === 0 && <Check className="h-3 w-3" />}
                  </span>
                  All reviewers
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                {allReviewers.map((login) => {
                  const active = selectedReviewers.includes(login);
                  return (
                    <button
                      key={login}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? selectedReviewers.filter((x) => x !== login)
                          : [...selectedReviewers, login];
                        setSelectedReviewers(next);
                        capture('filter_changed', { filter_type: 'reviewer', value: next.length });
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                        active ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-slate-600 dark:text-slate-300'
                      )}
                    >
                      <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      {login}
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
          title={hideBotPRs ? 'Click to show bot PRs (dependabot, renovate…)' : 'Click to hide bot PRs (dependabot, renovate…)'}
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
                              (preset.selectedReviewers?.length ?? 0) > 0 && `${preset.selectedReviewers.length} reviewer${preset.selectedReviewers.length > 1 ? 's' : ''}`,
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

        {/* Share link button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy shareable link to current filters"
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors border shrink-0 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          {copyLinkToast && (
            <div className="absolute top-full mt-1 right-0 z-50 bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
              Link copied!
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

      {/* Shared-link banner — shown when the URL embedded repo configurations */}
      {sharedLink && (
        <SharedLinkBanner
          hasPat={!!pat}
          status={sharedLink.status}
          accessible={sharedLink.accessible}
          inaccessible={sharedLink.inaccessible}
          onOpenSettings={onOpenSettings ?? (() => {})}
          onDismiss={() => setSharedLink(null)}
        />
      )}

      {/* Shared-link preview modal — shown before applying a share link */}
      {sharedLinkPayload && (
        <SharedLinkPreviewModal
          payload={sharedLinkPayload}
          currentRepoFilters={repoFilters}
          onApply={handleApplySharedLink}
          onDismiss={() => {
            setSharedLinkPayload(null);
            // Let the hash-write effect take over (clear the share hash).
            didReadHash.current = true;
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }}
        />
      )}

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
            {/* Pinned PRs */}
            {pinnedList.length > 0 && (
              <PRSection
                id="pinned"
                title="Pinned"
                icon={<Pin className="h-4 w-4" />}
                prs={pinnedList}
                ciStatuses={ciStatuses}
                approvalStatuses={approvalStatuses}
                conflictStatuses={conflictStatuses}
                sizeTotals={sizeTotals}
                accent="brand"
                defaultOpen
                showRepo={showRepoColumn}
                onSelectPR={setSelectedPR}
                pinnedPRs={pinnedPRs}
                onTogglePin={handleTogglePin}
              />
            )}
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
                pinnedPRs={pinnedPRs}
                onTogglePin={handleTogglePin}
              />
            ) : (
              <DndContext sensors={sensors} onDragEnd={handleSectionDragEnd}>
                <SortableContext
                  items={orderedSectionDefs.filter(s => s.prs.length > 0).map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {orderedSectionDefs.filter(s => s.prs.length > 0).map((section) => (
                    <SortablePRSection
                      key={section.id}
                      section={section}
                      ciStatuses={ciStatuses}
                      approvalStatuses={approvalStatuses}
                      conflictStatuses={conflictStatuses}
                      sizeTotals={sizeTotals}
                      showRepo={showRepoColumn}
                      onSelectPR={setSelectedPR}
                      pinnedPRs={pinnedPRs}
                      onTogglePin={handleTogglePin}
                    />
                  ))}
                </SortableContext>
              </DndContext>
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
