import type { PullRequest } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { AlertTriangle, ExternalLink, GitPullRequest } from 'lucide-react';
import { truncate } from '../../lib/utils';
import { differenceInDays } from 'date-fns';

interface Props {
  prs: PullRequest[];
  staleDays: number;
  loading?: boolean;
}

export function StalePRsCard({ prs, staleDays, loading }: Props) {
  const stalePRs = prs
    .filter((pr) => {
      if (pr.state !== 'open' || pr.draft) return false;
      return differenceInDays(new Date(), new Date(pr.updated_at)) >= staleDays;
    })
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
    .slice(0, 8);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Stale PRs
            {stalePRs.length > 0 && (
              <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {stalePRs.length}
              </span>
            )}
          </span>
        }
        subtitle={`Open PRs inactive for more than ${staleDays} days`}
        icon={<AlertTriangle className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
        </div>
      ) : stalePRs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-full mb-3">
            <GitPullRequest className="h-6 w-6 text-green-500" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No stale PRs!</p>
          <p className="text-xs text-slate-400 mt-1">All open PRs have recent activity</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stalePRs.map((pr) => {
            const daysStale = differenceInDays(new Date(), new Date(pr.updated_at));
            return (
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
                    <span className="text-xs text-slate-400">{pr.user.login}</span>
                  </div>
                </div>
                <Badge
                  variant={daysStale > 14 ? 'danger' : 'warning'}
                >
                  {daysStale}d ago
                </Badge>
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}
