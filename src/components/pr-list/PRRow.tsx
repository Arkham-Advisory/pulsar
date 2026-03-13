import { cn } from '../../lib/utils';
import { capture } from '../../lib/analytics';
import { getPRSizeLabel } from '../../lib/metrics';
import { useState } from 'react';
import type { PullRequest } from '../../types/github';
import type { ApprovalStatus } from '../../services/github';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Minus,
  HelpCircle,
  GitPullRequestDraft,
  ExternalLink,
  GitMerge,
  XOctagon,
  GitFork,
  Pin,
  Terminal,
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

interface Props {
  pr: PullRequest;
  ciStatus?: PullRequest['ciStatus'];
  approvalStatus?: ApprovalStatus;
  showRepo?: boolean;
  highlight?: boolean;
  section?: string;
  onSelect?: () => void;
  hasConflict?: boolean;
  sizeTotal?: number; // additions + deletions; undefined = not yet loaded
  isPinned?: boolean;
  onTogglePin?: () => void;
}

const CI_ICON = {
  success: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  failure: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  pending: <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />,
  neutral: <Minus className="h-3.5 w-3.5 text-slate-400" />,
  unknown: <HelpCircle className="h-3.5 w-3.5 text-slate-300" />,
};

const LABEL_COLORS: Record<string, string> = {};
function getLabelStyle(color: string) {
  if (LABEL_COLORS[color]) return LABEL_COLORS[color];
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  return `background-color:#${color};color:${(0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#000' : '#fff'}`;
}

const SIZE_STYLES: Record<string, string> = {
  Tiny:   'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  Small:  'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  Medium: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  Large:  'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  Huge:   'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

export function PRRow({ pr, ciStatus = pr.ciStatus, approvalStatus, showRepo = true, highlight = false, section, onSelect, hasConflict, sizeTotal, isPinned, onTogglePin }: Props) {
  const age = formatDistanceToNowStrict(new Date(pr.updated_at), { addSuffix: false });
  const isOld = (Date.now() - new Date(pr.updated_at).getTime()) > 1000 * 60 * 60 * 24 * 7;

  const [checkoutCopied, setCheckoutCopied] = useState(false);
  const checkoutCmd = `gh pr checkout ${pr.html_url}`;
  const handleCopyCheckout = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(checkoutCmd).then(() => {
      setCheckoutCopied(true);
      setTimeout(() => setCheckoutCopied(false), 2000);
    });
  };

  const labels = pr.labels.slice(0, 3);
  const extraLabels = pr.labels.length - 3;

  const handleGitHubClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    capture('pr_opened', {
      section,
      has_ci_status: ciStatus !== 'unknown',
      approval_status: approvalStatus ?? 'unknown',
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(); }}
      className={cn(
        'group flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60',
        'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors',
        onSelect && 'cursor-pointer',
        highlight && 'bg-amber-50/30 dark:bg-amber-900/10'
      )}
    >
      {/* CI Status — crossfades between states */}
      <div className="w-4 shrink-0 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={ciStatus}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center"
          >
            {CI_ICON[ciStatus]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Repo + number — trim repo name from the start so the tail stays readable */}
      {showRepo && (
        <div className="w-48 shrink-0 hidden md:block min-w-0">
          {(() => {
            const name = pr.repo.split('/')[1];
            const MAX = 18;
            const display = name.length > MAX ? '\u2026' + name.slice(name.length - MAX) : name;
            return (
              <span className="text-xs text-slate-600 dark:text-slate-400 block truncate" title={`${pr.repo} #${pr.number}`}>
                {display}
                <span className="ml-1 text-slate-400 dark:text-slate-600">#{pr.number}</span>
              </span>
            );
          })()}
        </div>
      )}
      {!showRepo && (
        <div className="w-16 shrink-0 hidden md:block">
          <span className="text-xs text-slate-500 dark:text-slate-400">#{pr.number}</span>
        </div>
      )}

      {/* Title */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {pr.draft && (
          <GitPullRequestDraft className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        )}
        <a
          href={pr.html_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleGitHubClick}
          title={pr.title}
          className={cn(
            'text-sm font-medium truncate',
            pr.draft
              ? 'text-slate-400 dark:text-slate-500'
              : 'text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400'
          )}
        >
          {pr.title}
        </a>
        <ExternalLink className="h-3 w-3 text-slate-300 dark:text-slate-600 group-hover:text-brand-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Status badges — fade in/out when approval / conflict state changes */}
        <AnimatePresence initial={false}>
          {approvalStatus === 'approved' && ciStatus !== 'failure' && (
            <motion.span
              key="ready"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="hidden sm:inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
            >
              <GitMerge className="h-2.5 w-2.5" />
              Ready
            </motion.span>
          )}
          {approvalStatus === 'changes_requested' && (
            <motion.span
              key="changes"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="hidden sm:inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
            >
              <XOctagon className="h-2.5 w-2.5" />
              Changes req.
            </motion.span>
          )}
          {hasConflict && (
            <motion.span
              key="conflict"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="hidden sm:inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800"
              title="This PR has a merge conflict (reported by GitHub)"
            >
              <GitFork className="h-2.5 w-2.5" />
              Conflict
            </motion.span>
          )}
        </AnimatePresence>

        {/* Labels — inline with title on small screens */}
        <div className="hidden sm:flex items-center gap-1 shrink-0 ml-1">
          {labels.map((l) => (
            <span
              key={l.name}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none"
              style={{ cssText: getLabelStyle(l.color) } as React.CSSProperties}
            >
              {l.name}
            </span>
          ))}
          {extraLabels > 0 && (
            <span className="text-[10px] text-slate-400">+{extraLabels}</span>
          )}
        </div>
      </div>

      {/* PR size badge — shown once pulls.get data has loaded (sizeTotal = additions+deletions) */}
      {(() => {
        if (sizeTotal === undefined) {
          return <div className="hidden sm:block w-14 shrink-0" />;
        }
        const sizeLabel = getPRSizeLabel(sizeTotal, 0);
        return (
          <div className="hidden sm:flex w-14 shrink-0 justify-start">
            <span
              title={`${sizeTotal} line${sizeTotal === 1 ? '' : 's'} changed`}
              className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none cursor-default', SIZE_STYLES[sizeLabel])}
            >
              {sizeLabel}
            </span>
          </div>
        );
      })()}

      {/* Author */}
      <div className="hidden sm:flex items-center gap-1.5 w-28 shrink-0">
        <img
          src={pr.user.avatar_url}
          alt={pr.user.login}
          className="w-5 h-5 rounded-full shrink-0"
        />
        <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{pr.user.login}</span>
      </div>

      {/* Requested reviewers */}
      <div className="hidden md:flex items-center w-16 shrink-0">
        {pr.requested_reviewers.length > 0 ? (
          <div className="flex -space-x-1">
            {pr.requested_reviewers.slice(0, 3).map((r) => (
              r.avatar_url
                ? <img
                    key={r.login}
                    src={r.avatar_url}
                    alt={r.login}
                    title={r.login}
                    className="w-5 h-5 rounded-full border border-white dark:border-slate-900"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                : <span
                    key={r.login}
                    title={r.login}
                    className="w-5 h-5 rounded-full border border-white dark:border-slate-900 bg-indigo-200 dark:bg-indigo-800 text-[8px] font-bold text-indigo-700 dark:text-indigo-200 flex items-center justify-center uppercase shrink-0"
                  >
                    {r.login.slice(0, 2)}
                  </span>
            ))}
            {pr.requested_reviewers.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-medium text-slate-500 flex items-center justify-center border border-white dark:border-slate-900">
                +{pr.requested_reviewers.length - 3}
              </div>
            )}
          </div>
        ) : pr.state === 'open' && !pr.draft ? (
          <span className="text-[10px] text-slate-400 dark:text-slate-600 italic">none</span>
        ) : null}
      </div>

      {/* Age — colour transition when staleness changes */}
      <div className="w-16 shrink-0 text-right">
        <span className={cn('text-xs transition-colors duration-700', isOld ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400')}>
          {age}
        </span>
      </div>

      {/* Action column (checkout + pin) — fixed width so it never shifts adjacent columns */}
      <div className="w-14 shrink-0 flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={handleCopyCheckout}
          title={checkoutCopied ? 'Copied!' : 'Copy checkout command'}
          aria-label={checkoutCopied ? 'Copied!' : 'Copy checkout command'}
          className={cn(
            'p-1 rounded transition-all',
            checkoutCopied
              ? 'text-green-500'
              : 'text-slate-400 dark:text-slate-500 hover:text-brand-500',
          )}
        >
          {checkoutCopied
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <Terminal className="h-3.5 w-3.5" />}
        </button>
        {onTogglePin && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            title={isPinned ? 'Unpin PR' : 'Pin PR'}
            aria-label={isPinned ? 'Unpin' : 'Pin'}
            className={cn(
              'p-1 rounded transition-all',
              isPinned
                ? 'text-brand-500 dark:text-brand-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-brand-500'
            )}
          >
            <Pin className={cn('h-3.5 w-3.5', isPinned && 'fill-current')} />
          </button>
        )}
      </div>
    </div>
  );
}
