import { useState, useCallback } from 'react';
import { useSettingsStore } from '../../store/settings';
import { validatePAT, fetchOwnerRepoCount } from '../../services/github';
import { capture } from '../../lib/analytics';
import { cn } from '../../lib/utils';
import { Spinner } from '../ui/Spinner';
import {
  X,
  Key,
  Github,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Settings,
  RefreshCw,
  Building2,
  Filter,
  GitFork,
  Target,
  Link2,
} from 'lucide-react';
import type { RepoFilterEntry, IssueTrackerConfig } from '../../types/settings';

interface Props {
  onClose: () => void;
}

type FilterMode = 'org' | 'prefix' | 'repo';
type PATStatus = 'idle' | 'validating' | 'valid' | 'invalid';

const MODE_LABELS: Record<FilterMode, string> = {
  org: 'Organization',
  prefix: 'Prefix',
  repo: 'Single Repo',
};

const MODE_ICONS: Record<FilterMode, React.ElementType> = {
  org: Building2,
  prefix: Filter,
  repo: GitFork,
};

const ENTRY_BADGE: Record<RepoFilterEntry['type'], string> = {
  org: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  prefix: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  repo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

function entryLabel(f: RepoFilterEntry): string {
  if (f.type === 'org') return f.owner;
  if (f.type === 'prefix') return `${f.owner} / ${f.prefix}*`;
  return `${f.owner}/${f.repo}`;
}

export function SettingsPanel({ onClose }: Props) {
  const {
    pat,
    setPat,
    setUserLogin,
    repoFilters,
    addRepoFilter,
    removeRepoFilter,
    timeRange,
    setTimeRange,
    staleDaysThreshold,
    setStaleDaysThreshold,
    refreshIntervalMinutes,
    setRefreshInterval,
    userLogin,
    slaPolicy,
    setSLAPolicy,
    issueTrackers,
    addIssueTracker,
    removeIssueTracker,
  } = useSettingsStore();

  const [localPat, setLocalPat] = useState(pat);
  const [patStatus, setPatStatus] = useState<PATStatus>(pat ? 'valid' : 'idle');
  const [patUser, setPatUser] = useState<string>(userLogin);
  const [patError, setPatError] = useState('');
  const [showPat, setShowPat] = useState(false);

  // Filter add form
  const [filterMode, setFilterMode] = useState<FilterMode>('org');
  const [ownerInput, setOwnerInput] = useState('');
  const [prefixInput, setPrefixInput] = useState('');
  const [repoInput, setRepoInput] = useState('');
  const [addError, setAddError] = useState('');
  const [checkingCount, setCheckingCount] = useState(false);
  type PendingOrg = { owner: string; count: number; id: string };
  const [pendingOrg, setPendingOrg] = useState<PendingOrg | null>(null);

  // Issue tracker add form
  type TrackerType = IssueTrackerConfig['type'];
  const [trackerType, setTrackerType] = useState<TrackerType>('github');
  const [trackerName, setTrackerName] = useState('');
  const [trackerBaseUrl, setTrackerBaseUrl] = useState('');
  const [trackerProjectKey, setTrackerProjectKey] = useState('');
  const [trackerPattern, setTrackerPattern] = useState('');
  const [trackerUrlTemplate, setTrackerUrlTemplate] = useState('');
  const [trackerError, setTrackerError] = useState('');

  const handleAddTracker = useCallback(() => {
    setTrackerError('');
    const name = trackerName.trim();
    const baseUrl = trackerBaseUrl.trim();
    if (!name) { setTrackerError('Name is required'); return; }
    if (trackerType !== 'github' && !baseUrl) { setTrackerError('Base URL is required'); return; }
    if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      setTrackerError('Base URL must start with http:// or https://');
      return;
    }
    if (trackerType === 'jira' && !trackerProjectKey.trim()) {
      setTrackerError('Project key is required for Jira');
      return;
    }
    if (trackerType === 'custom') {
      if (!trackerPattern.trim()) { setTrackerError('Pattern is required for custom tracker'); return; }
      if (!trackerUrlTemplate.trim()) { setTrackerError('URL template is required'); return; }
      if (!trackerUrlTemplate.includes('{{key}}')) { setTrackerError('URL template must contain {{key}}'); return; }
      try { new RegExp(trackerPattern); } catch { setTrackerError('Invalid regex pattern'); return; }
    }
    const tracker: IssueTrackerConfig = {
      id: crypto.randomUUID(),
      name,
      type: trackerType,
      baseUrl: trackerType === 'github' ? 'https://github.com' : baseUrl,
      ...(trackerType === 'jira' ? { projectKey: trackerProjectKey.trim().toUpperCase() } : {}),
      ...(trackerType === 'custom' ? { pattern: trackerPattern.trim(), urlTemplate: trackerUrlTemplate.trim() } : {}),
    };
    addIssueTracker(tracker);
    setTrackerName('');
    setTrackerBaseUrl('');
    setTrackerProjectKey('');
    setTrackerPattern('');
    setTrackerUrlTemplate('');
  }, [trackerType, trackerName, trackerBaseUrl, trackerProjectKey, trackerPattern, trackerUrlTemplate, addIssueTracker]);

  const handleValidatePAT = useCallback(async () => {
    if (!localPat.trim()) return;
    setPatStatus('validating');
    setPatError('');
    const result = await validatePAT(localPat);
    if (result.valid) {
      setPatStatus('valid');
      setPatUser(result.login || '');
      setPat(localPat);
      setUserLogin(result.login || '');
      capture('pat_validated', { success: true });
    } else {
      setPatStatus('invalid');
      setPatError(result.error || 'Invalid token');
      capture('pat_validated', { success: false });
    }
  }, [localPat, setPat]);

  const handleAddFilter = useCallback(async () => {
    setAddError('');
    const id = crypto.randomUUID();

    if (filterMode === 'org') {
      const owner = ownerInput.trim();
      if (!owner) { setAddError('Owner is required'); return; }
      setCheckingCount(true);
      const count = await fetchOwnerRepoCount(pat, owner);
      setCheckingCount(false);
      if (count > 100) {
        setPendingOrg({ owner, count, id });
        capture('large_org_warning_shown', { repo_count: count });
        return;
      }
      addRepoFilter({ id, type: 'org', owner });
      setOwnerInput('');
    } else if (filterMode === 'prefix') {
      const owner = ownerInput.trim();
      const prefix = prefixInput.trim();
      if (!owner) { setAddError('Owner is required'); return; }
      if (!prefix) { setAddError('Prefix is required'); return; }
      const entry: RepoFilterEntry = { id, type: 'prefix', owner, prefix };
      addRepoFilter(entry);
      setOwnerInput('');
      setPrefixInput('');
    } else {
      // repo mode — accept "owner/repo" or two fields
      let owner: string;
      let repo: string;
      const combined = repoInput.trim();
      if (combined.includes('/')) {
        [owner, repo] = combined.split('/').map((s) => s.trim());
      } else {
        owner = ownerInput.trim();
        repo = combined;
      }
      if (!owner || !repo) { setAddError('Enter owner/repo (e.g. my-org/api-service)'); return; }
      const entry: RepoFilterEntry = { id, type: 'repo', owner, repo };
      addRepoFilter(entry);
      setOwnerInput('');
      setRepoInput('');
    }
  }, [filterMode, ownerInput, prefixInput, repoInput, addRepoFilter, pat]);

  const handleClose = useCallback(() => {
    capture('settings_saved', {
      filter_count: repoFilters.length,
      time_range: timeRange,
      refresh_interval: refreshIntervalMinutes,
    });
    onClose();
  }, [repoFilters.length, timeRange, refreshIntervalMinutes, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="h-full w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-brand-50 dark:bg-brand-950/30 rounded-lg">
              <Settings className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
          </div>
          <button onClick={handleClose} className="btn-ghost p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* GitHub PAT */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Key className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                GitHub Access Token
              </h3>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showPat ? 'text' : 'password'}
                  value={localPat}
                  onChange={(e) => {
                    setLocalPat(e.target.value);
                    setPatStatus('idle');
                  }}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="input pr-20 font-mono text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && handleValidatePAT()}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded"
                  onClick={() => setShowPat((v) => !v)}
                  type="button"
                >
                  {showPat ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleValidatePAT}
                  disabled={!localPat.trim() || patStatus === 'validating'}
                  className={cn('btn-primary text-xs py-1.5', (!localPat.trim() || patStatus === 'validating') && 'opacity-50 cursor-not-allowed')}
                  type="button"
                >
                  {patStatus === 'validating' ? (
                    <><Spinner size="sm" /> Validating...</>
                  ) : (
                    <><Github className="h-3.5 w-3.5" /> Validate Token</>
                  )}
                </button>
                {patStatus === 'valid' && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" />
                    <span>Authenticated as <strong>{patUser}</strong></span>
                  </div>
                )}
                {patStatus === 'invalid' && (
                  <div className="flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{patError}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500">
                Requires <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">repo</code> scope.
                Your token is stored only in your browser's localStorage and never sent to any server.{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Pulsar+dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Create one here →
                </a>
              </p>
            </div>
          </section>

          {/* Repositories */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Github className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Repositories
              </h3>
            </div>

            {/* Existing filter entries */}
            {repoFilters.length > 0 && (
              <div className="space-y-2 mb-4">
                {repoFilters.map((filter) => {
                  const Icon = MODE_ICONS[filter.type];
                  return (
                    <div
                      key={filter.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                          {entryLabel(filter)}
                        </span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium shrink-0', ENTRY_BADGE[filter.type])}>
                          {filter.type}
                        </span>
                      </div>
                      <button
                        onClick={() => removeRepoFilter(filter.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors ml-2 shrink-0"
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mode selector */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-3">
              {(['org', 'prefix', 'repo'] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setFilterMode(mode); setAddError(''); }}
                  className={cn(
                    'flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors',
                    filterMode === mode
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                >
                  {MODE_LABELS[mode]}
                </button>
              ))}
            </div>

            {/* Input fields per mode */}
            <div className="space-y-2">
              {filterMode === 'org' && (
                <input
                  type="text"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  placeholder="org-name or username"
                  className="input text-sm w-full"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                />
              )}

              {filterMode === 'prefix' && (
                <>
                  <input
                    type="text"
                    value={ownerInput}
                    onChange={(e) => setOwnerInput(e.target.value)}
                    placeholder="org-name or username"
                    className="input text-sm w-full"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                  />
                  <input
                    type="text"
                    value={prefixInput}
                    onChange={(e) => setPrefixInput(e.target.value)}
                    placeholder="repo prefix (e.g. backend-)"
                    className="input text-sm w-full"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                  />
                </>
              )}

              {filterMode === 'repo' && (
                <input
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="owner/repo-name"
                  className="input text-sm w-full"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                />
              )}

              <button
                onClick={handleAddFilter}
                disabled={checkingCount}
                className={cn('btn-secondary text-xs w-full', checkingCount && 'opacity-60 cursor-not-allowed')}
                type="button"
              >
                {checkingCount ? (
                  <><Spinner size="sm" /> Checking repo count…</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" /> Add {MODE_LABELS[filterMode]}</>
                )}
              </button>

              {/* Large-org confirmation */}
              {pendingOrg && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>{pendingOrg.owner}</strong> has <strong>{pendingOrg.count} repositories</strong>.
                      Tracking all of them may be slow and consume a lot of API quota.{' '}
                      Consider using the <strong>Prefix</strong> filter to narrow down to the repos that matter.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => {
                        addRepoFilter({ id: pendingOrg.id, type: 'org', owner: pendingOrg.owner });
                        setOwnerInput('');
                        setPendingOrg(null);
                        capture('large_org_warning_shown', { repo_count: pendingOrg.count, action: 'add_anyway' });
                      }}
                    >
                      Add anyway
                    </button>
                    <button
                      type="button"
                      className="flex-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                      onClick={() => {
                        capture('large_org_warning_shown', { repo_count: pendingOrg.count, action: 'use_prefix' });
                        setPendingOrg(null);
                        setFilterMode('prefix');
                      }}
                    >
                      Use Prefix instead
                    </button>
                  </div>
                </div>
              )}

              {addError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {addError}
                </p>
              )}

              <p className="text-xs text-slate-400 dark:text-slate-500">
                {filterMode === 'org' && 'Tracks all repositories under this GitHub organization or user.'}
                {filterMode === 'prefix' && 'Tracks only repositories whose names start with the given prefix.'}
                {filterMode === 'repo' && 'Tracks a single specific repository.'}
              </p>
            </div>
          </section>

          {/* Time & Display settings */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Display Settings
              </h3>
            </div>
            <div className="space-y-4">
              {/* Time range */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Time range
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['7d', '14d', '30d', '60d', '90d'] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setTimeRange(range)}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-lg font-medium transition-colors',
                        timeRange === range
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      )}
                    >
                      {range === '7d' ? '7 days' : range === '14d' ? '14 days' : range === '30d' ? '30 days' : range === '60d' ? '60 days' : '90 days'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stale days threshold */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Stale PR threshold
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={staleDaysThreshold}
                    onChange={(e) => setStaleDaysThreshold(Number(e.target.value))}
                    className="flex-1 accent-brand-600"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-16 text-right">
                    {staleDaysThreshold} days
                  </span>
                </div>
              </div>

              {/* Refresh interval */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Auto-refresh interval
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[5, 15, 30, 60].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setRefreshInterval(min)}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-lg font-medium transition-colors',
                        refreshIntervalMinutes === min
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      )}
                    >
                      {min}m
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </section>

          {/* SLA Targets */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                SLA Targets
              </h3>
            </div>
            <div className="space-y-5">
              {/* First Review */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Open → First review
                  </label>
                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
                    {slaPolicy.firstReviewHours}h
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={48}
                  value={slaPolicy.firstReviewHours}
                  onChange={e => setSLAPolicy({ ...slaPolicy, firstReviewHours: Number(e.target.value) })}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>1h</span><span>48h</span>
                </div>
              </div>
              {/* Approval */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    First review → Approval
                  </label>
                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
                    {slaPolicy.approvalHours}h
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={72}
                  value={slaPolicy.approvalHours}
                  onChange={e => setSLAPolicy({ ...slaPolicy, approvalHours: Number(e.target.value) })}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>1h</span><span>72h</span>
                </div>
              </div>
              {/* Merge */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Approval → Merge
                  </label>
                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
                    {slaPolicy.mergeHours}h
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={96}
                  value={slaPolicy.mergeHours}
                  onChange={e => setSLAPolicy({ ...slaPolicy, mergeHours: Number(e.target.value) })}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>1h</span><span>96h</span>
                </div>
              </div>
            </div>
          </section>

          {/* Issue Trackers */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Issue Trackers
              </h3>
            </div>

            {/* Existing trackers */}
            {issueTrackers.length > 0 && (
              <div className="mb-4 space-y-2">
                {issueTrackers.map(tracker => (
                  <div
                    key={tracker.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                        tracker.type === 'github' && 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                        tracker.type === 'jira' && 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
                        tracker.type === 'custom' && 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
                      )}>
                        {tracker.type}
                      </span>
                      <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                        {tracker.name}
                      </span>
                      {tracker.projectKey && (
                        <span className="shrink-0 text-xs text-slate-400">{tracker.projectKey}-N</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeIssueTracker(tracker.id)}
                      className="ml-2 shrink-0 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Remove tracker"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add tracker form */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Add a tracker to auto-link issue references in PR descriptions.</p>

              {/* Type selector */}
              <div className="flex gap-1.5">
                {(['github', 'jira', 'custom'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTrackerType(t)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors',
                      trackerType === t
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Name */}
              <input
                type="text"
                placeholder="Display name (e.g. My Jira)"
                value={trackerName}
                onChange={e => setTrackerName(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />

              {/* GitHub: no extra fields needed */}
              {trackerType === 'github' && (
                <p className="text-[11px] text-slate-400">
                  Auto-links <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">#N</code> references to your GitHub repos.
                </p>
              )}

              {/* Jira: base URL + project key */}
              {trackerType === 'jira' && (
                <>
                  <input
                    type="url"
                    placeholder="Base URL (e.g. https://yourteam.atlassian.net)"
                    value={trackerBaseUrl}
                    onChange={e => setTrackerBaseUrl(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <input
                    type="text"
                    placeholder="Project key (e.g. MYPROJ)"
                    value={trackerProjectKey}
                    onChange={e => setTrackerProjectKey(e.target.value.toUpperCase())}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </>
              )}

              {/* Custom: base URL + regex pattern + URL template */}
              {trackerType === 'custom' && (
                <>
                  <input
                    type="url"
                    placeholder="Base URL (optional)"
                    value={trackerBaseUrl}
                    onChange={e => setTrackerBaseUrl(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <input
                    type="text"
                    placeholder="Regex pattern (e.g. LIN-\d+)"
                    value={trackerPattern}
                    onChange={e => setTrackerPattern(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <input
                    type="text"
                    placeholder="URL template (e.g. https://linear.app/issue/{{key}})"
                    value={trackerUrlTemplate}
                    onChange={e => setTrackerUrlTemplate(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    Use <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{key}}'}</code> in the URL template as the matched key placeholder.
                  </p>
                </>
              )}

              {trackerError && (
                <p className="text-xs text-red-500 dark:text-red-400">{trackerError}</p>
              )}

              <button
                type="button"
                onClick={handleAddTracker}
                className="w-full rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                Add tracker
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
