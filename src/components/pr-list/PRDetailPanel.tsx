import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useSettingsStore } from '../../store/settings';
import { fetchPRDetails } from '../../services/github';
import type { PullRequest } from '../../types/github';
import type { ApprovalStatus } from '../../services/github';
import type { IssueTrackerConfig as IssueTrackerConfigSettings } from '../../types/settings';
import {
  X, ExternalLink, GitBranch, GitMerge, GitPullRequestDraft,
  XOctagon, CheckCircle2, XCircle, Clock, Minus, HelpCircle, User, Terminal,
  ArrowLeftRight, AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '../../lib/utils';
import { Spinner } from '../ui/Spinner';
import { PRLifecycleTimeline } from './PRLifecycleTimeline';
import { TitleWithIssueLinks } from './IssueLinks';

// ─── Issue tracker link processing ───────────────────────────────────────────
// Replaces tracker references in markdown text with proper links.
// Skips content inside code fences and inline code.
function processIssueLinks(
  text: string,
  trackers: IssueTrackerConfigSettings[],
  repo: string
): string {
  if (trackers.length === 0) return text;

  let inCodeBlock = false;
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        return line;
      }
      if (inCodeBlock) return line;
      // Mask inline code so we don't replace inside it
      const codeSegments: string[] = [];
      const masked = line.replace(/`[^`]*`/g, (m) => {
        codeSegments.push(m);
        return `\x00CODE${codeSegments.length - 1}\x00`;
      });

      let processed = masked;
      for (const tracker of trackers) {
        if (tracker.type === 'github') {
          // Replace #N not already in a markdown link [...](...) or ](...)
          processed = processed.replace(/(?<!\[)#(\d+)(?!\])/g, (_, n) => {
            const url = `https://github.com/${repo}/issues/${n}`;
            return `[#${n}](${url})`;
          });
        } else if (tracker.type === 'jira' && tracker.projectKey) {
          const key = tracker.projectKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(?<![\\[(])\\b(${key}-\\d+)\\b`, 'g');
          processed = processed.replace(regex, (match) => {
            // Validate the base URL before creating link
            const base = tracker.baseUrl.replace(/\/$/, '');
            if (!base.startsWith('http://') && !base.startsWith('https://')) return match;
            return `[${match}](${base}/browse/${match})`;
          });
        } else if (tracker.type === 'custom' && tracker.pattern && tracker.urlTemplate) {
          try {
            const regex = new RegExp(tracker.pattern, 'g');
            processed = processed.replace(regex, (match) => {
              const url = tracker.urlTemplate!.replace('{{key}}', encodeURIComponent(match));
              if (!url.startsWith('http://') && !url.startsWith('https://')) return match;
              return `[${match}](${url})`;
            });
          } catch {
            // ignore invalid regex
          }
        }
      }
      // Restore inline code
      return processed.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeSegments[Number(i)]);
    })
    .join('\n');
}

interface Props {
  pr: PullRequest;
  ciStatus?: PullRequest['ciStatus'];
  approvalStatus?: ApprovalStatus;
  hasConflict?: boolean;
  onClose: () => void;
  roundTrips?: number;
}

const CI_INFO: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  success: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'CI passing',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  failure: { icon: <XCircle      className="h-3.5 w-3.5" />, label: 'CI failing',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  pending: { icon: <Clock        className="h-3.5 w-3.5 animate-pulse" />, label: 'CI pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  neutral: { icon: <Minus        className="h-3.5 w-3.5" />, label: 'No CI',       cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  unknown: { icon: <HelpCircle   className="h-3.5 w-3.5" />, label: 'CI unknown',  cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500' },
};

function getLabelStyle(color: string): React.CSSProperties {
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  return {
    backgroundColor: `#${color}`,
    color: (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#000' : '#fff',
  };
}

function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide font-medium text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}

export function PRDetailPanel({ pr, ciStatus = pr.ciStatus, approvalStatus, hasConflict, onClose, roundTrips }: Props) {
  const { pat, issueTrackers } = useSettingsStore();
  const [checkoutCopied, setCheckoutCopied] = useState(false);

  const checkoutCmd = `gh pr checkout ${pr.html_url}`;

  const handleCopyCheckout = () => {
    navigator.clipboard.writeText(checkoutCmd).then(() => {
      setCheckoutCopied(true);
      setTimeout(() => setCheckoutCopied(false), 2000);
    });
  };

  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ['pr-details', pr.repo, pr.number],
    queryFn: () => fetchPRDetails(pat, pr.repo, pr.number),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const additions = details?.additions ?? pr.additions;
  const deletions = details?.deletions ?? pr.deletions;
  const changedFiles = details?.changed_files ?? pr.changed_files;
  const commits = details?.commits ?? pr.commits;
  const comments = (details?.comments ?? pr.comments) + (details?.review_comments ?? pr.review_comments);
  const rawBody = details?.body ?? null;
  const body = rawBody ? processIssueLinks(rawBody, issueTrackers, pr.repo) : rawBody;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const ci = CI_INFO[ciStatus] ?? CI_INFO.unknown;
  const repoName = pr.repo.split('/')[1];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[600px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`PR #${pr.number}: ${pr.title}`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost p-1.5 -ml-1 shrink-0"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="text-xs font-mono text-slate-400 shrink-0">{repoName}#{pr.number}</span>
          <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
            <TitleWithIssueLinks text={pr.title} repo={pr.repo} />
          </span>
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost p-1.5 shrink-0"
            title="Open in GitHub"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={handleCopyCheckout}
              className="btn-ghost p-1.5"
              title={checkoutCopied ? 'Copied!' : `Copy: ${checkoutCmd}`}
            >
              {checkoutCopied
                ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                : <Terminal className="h-4 w-4" />}
            </button>
            {checkoutCopied && (
              <div className="absolute top-full mt-1 right-0 z-50 bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
                Copied to clipboard!
              </div>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* Author + dates */}
            <div className="flex items-center gap-3">
              <img src={pr.user.avatar_url} alt={pr.user.login} className="w-8 h-8 rounded-full shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{pr.user.login}</p>
                <p className="text-xs text-slate-400">
                  opened {formatDistanceToNow(new Date(pr.created_at), { addSuffix: true })}
                  {pr.updated_at !== pr.created_at && (
                    <> · updated {formatDistanceToNow(new Date(pr.updated_at), { addSuffix: true })}</>
                  )}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                {pr.draft && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <GitPullRequestDraft className="h-3 w-3" />Draft
                  </span>
                )}
                {pr.merged && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    <GitMerge className="h-3 w-3" />Merged
                  </span>
                )}
              </div>
            </div>

            {/* Branch */}
            <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-slate-600 dark:text-slate-400 overflow-x-auto">
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{pr.head.ref}</span>
              <span className="text-slate-300 dark:text-slate-600 shrink-0">→</span>
              <span className="truncate">{pr.base.ref}</span>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full', ci.cls)}>
                {ci.icon}{ci.label}
              </span>
              {approvalStatus === 'approved' && (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />Approved
                </span>
              )}
              {approvalStatus === 'changes_requested' && (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <XOctagon className="h-3.5 w-3.5" />Changes requested
                </span>
              )}
              {hasConflict && (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <AlertTriangle className="h-3.5 w-3.5" />Merge conflict
                </span>
              )}
            </div>

            {/* Labels */}
            {pr.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pr.labels.map((l) => (
                  <span
                    key={l.name}
                    className="text-xs font-medium px-2 py-0.5 rounded-full leading-none"
                    style={getLabelStyle(l.color)}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <StatItem
                label="Changes"
                value={
                  <span>
                    <span className="text-green-600 dark:text-green-400">+{additions}</span>
                    {' / '}
                    <span className="text-red-500">-{deletions}</span>
                  </span>
                }
              />
              <StatItem label="Files" value={changedFiles} />
              <StatItem label="Commits" value={commits} />
              <StatItem label="Comments" value={comments} />
              {roundTrips !== undefined && roundTrips > 0 && (
                <StatItem
                  label="Review rounds"
                  value={
                    <span className={cn('flex items-center gap-1', roundTrips >= 3 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200')}>
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {roundTrips}
                    </span>
                  }
                />
              )}
            </div>

            {/* Lifecycle Timeline */}
            {!detailsLoading && (
              <PRLifecycleTimeline
                openedAt={pr.created_at}
                firstCommitAt={details?.firstCommitAt ?? null}
                firstReviewAt={details?.firstReviewAt ?? null}
                firstReviewUser={details?.firstReviewUser ?? null}
                approvedAt={details?.approvedAt ?? null}
                approvedBy={details?.approvedBy ?? null}
                mergedAt={pr.merged_at}
              />
            )}

            {/* Requested reviewers */}
            {pr.requested_reviewers.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Awaiting Review
                </h3>
                <div className="space-y-1.5">
                  {pr.requested_reviewers.map((r) => (
                    <div key={r.login} className="flex items-center gap-2">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt={r.login} className="w-6 h-6 rounded-full shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          <User className="h-3 w-3 text-slate-500" />
                        </div>
                      )}
                      <span className="text-sm text-slate-700 dark:text-slate-300">@{r.login}</span>
                      <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assignees */}
            {pr.assignees.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Assignees
                </h3>
                <div className="space-y-1.5">
                  {pr.assignees.map((a) => (
                    <div key={a.login} className="flex items-center gap-2">
                      <img src={a.avatar_url} alt={a.login} className="w-6 h-6 rounded-full shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">@{a.login}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Description
              </h3>
              {detailsLoading ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : body ? (
                <div className="prose prose-sm dark:prose-invert max-w-none bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-slate-700 dark:text-slate-300 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mt-3 [&_h2]:mt-2 [&_h3]:mt-2 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_pre]:bg-slate-200 dark:[&_pre]:bg-slate-700 [&_pre]:rounded [&_pre]:p-2 [&_pre]:overflow-x-auto [&_code]:bg-slate-200 dark:[&_code]:bg-slate-700 [&_code]:rounded [&_code]:px-1 [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 dark:[&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_a]:text-brand-600 dark:[&_a]:text-brand-400 [&_a]:underline [&_hr]:border-slate-200 dark:[&_hr]:border-slate-700">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      // Open links in new tab safely
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                      ),
                      // Prevent unwrapping issues with inline code inside pre
                      pre: ({ children }) => <pre>{children}</pre>,
                    }}
                  >
                    {body}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No description provided.</p>
              )}
            </div>

            {/* Merge timestamp */}
            {pr.merged && pr.merged_at && (
              <p className="text-xs text-slate-400">
                Merged {format(new Date(pr.merged_at), 'MMM d, yyyy · HH:mm')}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
