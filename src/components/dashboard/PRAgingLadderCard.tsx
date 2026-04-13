import type { PRAgingBucket } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { GitPullRequest } from 'lucide-react';

interface Props {
  buckets: PRAgingBucket[];
  loading?: boolean;
}

export function PRAgingLadderCard({ buckets, loading }: Props) {
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return (
    <Card>
      <CardHeader
        title="PR Aging Ladder"
        subtitle="Open PRs by age bucket"
        icon={<GitPullRequest className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-12 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {buckets.map((bucket) => (
            <div key={bucket.label}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{bucket.label}</span>
                <span>{bucket.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-brand-500"
                  style={{ width: `${(bucket.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
