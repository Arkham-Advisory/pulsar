import { cn } from '../../lib/utils';
import { capture } from '../../lib/analytics';
import type { PullRequest } from '../../types/github';
import type { ApprovalStatus } from '../../services/github';
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
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

interface Props {
  pr: PullRequest;
  ciStatus?: PullRequest['ciStatus'];
  approvalStatus?: ApprovalStatus;
  showRepo?: boolean;
  highlight?: boolean;
  section?: string;
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

export function PRRow({ pr, ciStatus = pr.ciStatus, approvalStatus, showRepo = true, highlight = false, section }: Props) {
  const age = formatDistanceToNowStrict(new Date(pr.updated_at), { addSuffix: false });
  const isOld = (Date.now() - new Date(pr.updated_at).getTime()) > 1000 * 60 * 60 * 24 * 7;

  const labels = pr.labels.slice(0, 3);
  const extraLabels = pr.labels.length - 3;

  const handleClick = () => capture('pr_opened', {
    section,
    has_ci_status: ciStatus !== 'unknown',
    approval_status: approvalStatus ?? 'unknown',
  });

  return (
    <a
      href={pr.html_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={cn(
        'group flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60',
        'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors',
        highlight && 'bg-amber-50/30 dark:bg-amber-900/10'
      )}
    >
      {/* CI Status */}
      <div className="w-4 shrink-0 flex items-center justify-center">
        {CI_ICON[ciStatus]}
      </div>

      {/* Repo + number */}
      {showRepo && (
        <div className="w-52 shrink-0 hidden md:block min-w-0">
          <span className="text-xs text-slate-600 dark:text-slate-400 truncate block" title={pr.repo}>
            {pr.repo.split('/')[1]}
            <span className="ml-1 text-slate-400 dark:text-slate-600">#{pr.number}</span>
          </span>
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
        <span className={cn(
          'text-sm font-medium truncate',
          pr.draft
            ? 'text-slate-400 dark:text-slate-500'
            : 'text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400'
        )}>
          {pr.title}
        </span>
        <ExternalLink className="h-3 w-3 text-slate-300 dark:text-slate-600 group-hover:text-brand-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Approval badge */}
        {approvalStatus === 'approved' && ciStatus !== 'failure' && (
          <span className="hidden sm:inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
            <GitMerge className="h-2.5 w-2.5" />
            Ready
          </span>
        )}
        {approvalStatus === 'changes_requested' && (
          <span className="hidden sm:inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
            <XOctagon className="h-2.5 w-2.5" />
            Changes req.
          </span>
        )}

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

      {/* Age */}
      <div className="w-16 shrink-0 text-right">
        <span className={cn('text-xs', isOld ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400')}>
          {age}
        </span>
      </div>
    </a>
  );
}
