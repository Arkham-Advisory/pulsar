import { useState, useCallback } from 'react';
import {
  Link2,
  X,
  Check,
  Search,
  GitMerge,
  Users,
  Bot,
  LayoutList,
  Building2,
  GitBranch,
  Key,
  Github,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { validatePAT } from '../../services/github';
import { useSettingsStore } from '../../store/settings';
import { Spinner } from '../ui/Spinner';
import type { RepoFilterEntry } from '../../types/settings';

export interface SharedLinkPayload {
  share?: boolean;
  search?: string;
  stateFilter?: 'open' | 'merged';
  selectedRepos?: string[];
  hideBotPRs?: boolean;
  selectedReviewers?: string[];
  sectionOrder?: string[];
  repoFilters?: RepoFilterEntry[];
}

type PATStatus = 'idle' | 'validating' | 'valid' | 'invalid';

interface Props {
  payload: SharedLinkPayload;
  currentRepoFilters: RepoFilterEntry[];
  onApply: (payload: SharedLinkPayload, replaceRepoFilters: boolean) => void;
  onDismiss: () => void;
  /** When true, an embedded PAT field is shown and must be validated before applying. */
  requiresPAT?: boolean;
}

const DEFAULT_ORDER = [
  'ready-to-merge', 'needs-attention', 'review-requested', 'my-prs', 'all-prs', 'drafts',
];

function entryLabel(f: RepoFilterEntry): string {
  if (f.type === 'org') return f.owner;
  if (f.type === 'prefix') return `${f.owner}/${f.prefix}*`;
  return `${f.owner}/${f.repo}`;
}

function entryKind(f: RepoFilterEntry): string {
  if (f.type === 'org') return 'org';
  if (f.type === 'prefix') return 'prefix';
  return 'repo';
}

function RepoEntry({ f }: { f: RepoFilterEntry }) {
  return (
    <div className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium flex-1 truncate">{entryLabel(f)}</span>
      <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-700 rounded px-1.5 py-0.5 shrink-0">
        {entryKind(f)}
      </span>
    </div>
  );
}

function FilterRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 w-24 shrink-0">{label}</span>
      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">{value}</span>
    </div>
  );
}

export function SharedLinkPreviewModal({ payload, currentRepoFilters, onApply, onDismiss, requiresPAT }: Props) {
  const hasUserConfig = currentRepoFilters.length > 0;
  const [replaceRepos, setReplaceRepos] = useState(!hasUserConfig);

  // PAT entry (only used when requiresPAT is true)
  const { setPat, setUserLogin } = useSettingsStore();
  const [localPat, setLocalPat] = useState('');
  const [patStatus, setPatStatus] = useState<PATStatus>('idle');
  const [patUser, setPatUser] = useState('');
  const [patError, setPatError] = useState('');
  const [showPat, setShowPat] = useState(false);

  const handleValidatePAT = useCallback(async () => {
    if (!localPat.trim()) return;
    setPatStatus('validating');
    setPatError('');
    const result = await validatePAT(localPat);
    if (result.valid) {
      setPatStatus('valid');
      setPatUser(result.login || '');
    } else {
      setPatStatus('invalid');
      setPatError(result.error || 'Invalid token');
    }
  }, [localPat]);

  const handleApply = useCallback(() => {
    if (requiresPAT) {
      if (patStatus !== 'valid') return;
      // Persist the PAT before handing control to the parent
      setPat(localPat);
      setUserLogin(patUser);
    }
    onApply(payload, replaceRepos);
  }, [requiresPAT, patStatus, localPat, patUser, setPat, setUserLogin, onApply, payload, replaceRepos]);

  const hasSearch = !!payload.search;
  const hasMergedState = payload.stateFilter === 'merged';
  const hasRepoFilter = (payload.selectedRepos?.length ?? 0) > 0;
  const hasReviewerFilter = (payload.selectedReviewers?.length ?? 0) > 0;
  const hasBotFilter = !!payload.hideBotPRs;
  const hasCustomOrder =
    Array.isArray(payload.sectionOrder) &&
    (payload.sectionOrder.length !== DEFAULT_ORDER.length ||
      payload.sectionOrder.some((id, i) => id !== DEFAULT_ORDER[i]));
  const hasRepoSources = (payload.repoFilters?.length ?? 0) > 0;
  const hasAnyFilter =
    hasSearch || hasMergedState || hasRepoFilter || hasReviewerFilter || hasBotFilter || hasCustomOrder;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
            <Link2 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Shared link</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review before applying to this tab
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* PAT section — shown when the user has no PAT yet */}
          {requiresPAT && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  GitHub Access Token
                </p>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showPat ? 'text' : 'password'}
                    value={localPat}
                    onChange={(e) => { setLocalPat(e.target.value); setPatStatus('idle'); }}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="input pr-16 font-mono text-xs w-full"
                    onKeyDown={(e) => e.key === 'Enter' && handleValidatePAT()}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded"
                    onClick={() => setShowPat((v) => !v)}
                  >
                    {showPat ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleValidatePAT}
                    disabled={!localPat.trim() || patStatus === 'validating'}
                    className={cn('btn-primary text-xs py-1.5', (!localPat.trim() || patStatus === 'validating') && 'opacity-50 cursor-not-allowed')}
                  >
                    {patStatus === 'validating' ? (
                      <><Spinner size="sm" /> Validating…</>
                    ) : (
                      <><Github className="h-3.5 w-3.5" /> Verify token</>
                    )}
                  </button>
                  {patStatus === 'valid' && (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Check className="h-3.5 w-3.5" />
                      Authenticated as <strong>{patUser}</strong>
                    </span>
                  )}
                  {patStatus === 'invalid' && (
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {patError}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Requires <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">repo</code> scope.
                  Your token is stored only in your browser and never sent to any server.{' '}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Pulsar+dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Create one →
                  </a>
                </p>
              </div>
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800" />
            </div>
          )}

          {/* Filters */}
          {hasAnyFilter && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Filters
              </p>
              <div className="space-y-1">
                {hasMergedState && (
                  <FilterRow
                    icon={<GitMerge className="h-3.5 w-3.5" />}
                    label="State"
                    value="Merged PRs"
                  />
                )}
                {hasSearch && (
                  <FilterRow
                    icon={<Search className="h-3.5 w-3.5" />}
                    label="Search"
                    value={`"${payload.search}"`}
                  />
                )}
                {hasRepoFilter && (
                  <FilterRow
                    icon={<GitBranch className="h-3.5 w-3.5" />}
                    label="Repos"
                    value={payload.selectedRepos!.join(', ')}
                  />
                )}
                {hasReviewerFilter && (
                  <FilterRow
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="Reviewers"
                    value={payload.selectedReviewers!.join(', ')}
                  />
                )}
                {hasBotFilter && (
                  <FilterRow
                    icon={<Bot className="h-3.5 w-3.5" />}
                    label="Bots"
                    value="Hidden"
                  />
                )}
                {hasCustomOrder && (
                  <FilterRow
                    icon={<LayoutList className="h-3.5 w-3.5" />}
                    label="Section order"
                    value="Custom layout"
                  />
                )}
              </div>
            </div>
          )}

          {/* Repo sources */}
          {hasRepoSources && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Repo sources in this link
              </p>
              <div className="space-y-1">
                {payload.repoFilters!.map((f, i) => (
                  <RepoEntry key={i} f={f} />
                ))}
              </div>

              {hasUserConfig && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Your current repo sources
                  </p>
                  <div className="space-y-1 mb-3">
                    {currentRepoFilters.map((f) => (
                      <RepoEntry key={f.id} f={f} />
                    ))}
                  </div>
                  {/* Replace / merge toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={replaceRepos}
                    onClick={() => setReplaceRepos((v) => !v)}
                    className="flex items-center gap-2.5 w-full text-left group"
                  >
                    <span
                      className={cn(
                        'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                        replaceRepos
                          ? 'bg-brand-600'
                          : 'bg-slate-300 dark:bg-slate-600',
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow ring-0 transition-transform',
                          replaceRepos ? 'translate-x-3' : 'translate-x-0',
                        )}
                      />
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                      Replace my repo sources with those from this link
                    </span>
                  </button>
                  {!replaceRepos && (
                    <p className="text-[11px] text-slate-400 mt-1.5 ml-9">
                      Shared sources will be added alongside your existing ones.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {!hasAnyFilter && !hasRepoSources && (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
              This link doesn't contain any custom settings.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={handleApply}
            disabled={requiresPAT && patStatus !== 'valid'}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-9 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors',
              requiresPAT && patStatus !== 'valid' && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Check className="h-3.5 w-3.5" />
            Apply to this tab
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="h-9 px-4 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
