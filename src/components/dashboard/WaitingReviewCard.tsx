import type { PullRequest } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Eye, ExternalLink, GitMerge } from 'lucide-react';
import { getRelativeTime, truncate } from '../../lib/utils';

interface Props {
  prs: PullRequest[];
  loading?: boolean;
}

export function WaitingReviewCard({ prs, loading }: Props) {
  const waitingPRs = prs
    .filter((pr) => pr.state === 'open' && !pr.draft && pr.requested_reviewers.length > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 8);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Awaiting Review
            {waitingPRs.length > 0 && (
              <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {waitingPRs.length}
              </span>
            )}
          </span>
        }
        subtitle="Open PRs with pending review requests"
        icon={<Eye className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
        </div>
      ) : waitingPRs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-full mb-3">
            <GitMerge className="h-6 w-6 text-green-500" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Review queue is clear!</p>
          <p className="text-xs text-slate-400 mt-1">No PRs are waiting for review</p>
        </div>
      ) : (
        <div className="space-y-2">
          {waitingPRs.map((pr) => (
            <a
              key={pr.id}
              href={pr.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <img
                src={pr.user.avatar_url}
                alt={pr.user.login}
                className="w-7 h-7 rounded-full mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug line-clamp-1">
                    {truncate(pr.title, 60)}
                  </span>
                  <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-brand-500 flex-shrink-0 mt-0.5 transition-colors" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">{pr.repo.split('/')[1]}#{pr.number}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <div className="flex -space-x-1">
                    {pr.requested_reviewers.slice(0, 3).map((r) => (
                      <img
                        key={r.login}
                        src={r.avatar_url}
                        title={r.login}
                        className="w-4 h-4 rounded-full border border-white dark:border-slate-800"
                      />
                    ))}
                    {pr.requested_reviewers.length > 3 && (
                      <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-medium text-slate-500 border border-white dark:border-slate-800">
                        +{pr.requested_reviewers.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{getRelativeTime(pr.created_at)}</span>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
