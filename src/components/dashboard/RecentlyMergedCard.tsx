import type { PullRequest } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { GitMerge, ExternalLink, Plus, Minus } from 'lucide-react';
import { getRelativeTime, truncate } from '../../lib/utils';

interface Props {
  prs: PullRequest[];
  loading?: boolean;
}

export function RecentlyMergedCard({ prs, loading }: Props) {
  const mergedPRs = prs
    .filter((pr) => pr.merged && pr.merged_at)
    .sort((a, b) => new Date(b.merged_at!).getTime() - new Date(a.merged_at!).getTime())
    .slice(0, 8);

  return (
    <Card>
      <CardHeader
        title="Recently Merged"
        subtitle="Latest merged pull requests"
        icon={<GitMerge className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
        </div>
      ) : mergedPRs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-slate-400">No merged PRs in the selected time range</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mergedPRs.map((pr) => (
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
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                    <Plus className="h-2.5 w-2.5" />{pr.additions}
                  </span>
                  <span className="text-xs text-red-500 flex items-center gap-0.5">
                    <Minus className="h-2.5 w-2.5" />{pr.deletions}
                  </span>
                </div>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{getRelativeTime(pr.merged_at!)}</span>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
