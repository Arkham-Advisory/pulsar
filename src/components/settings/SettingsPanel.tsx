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
} from 'lucide-react';
import type { RepoFilterEntry } from '../../types/settings';

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
    darkMode,
    toggleDarkMode,
    refreshIntervalMinutes,
    setRefreshInterval,
    userLogin,
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

              {/* Dark mode toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Dark mode</div>
                </div>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    darkMode ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
