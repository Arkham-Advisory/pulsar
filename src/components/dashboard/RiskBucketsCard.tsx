import type { RiskBucket } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ShieldAlert } from 'lucide-react';

interface Props {
  buckets: RiskBucket[];
  loading?: boolean;
}

export function RiskBucketsCard({ buckets, loading }: Props) {
  return (
    <Card>
      <CardHeader
        title="Risk Buckets"
        subtitle="How open pull requests cluster into risky patterns"
        icon={<ShieldAlert className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {buckets.map((bucket) => (
            <div
              key={bucket.label}
              className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{bucket.label}</p>
                <p className="text-xs text-slate-400">{bucket.description}</p>
              </div>
              <Badge variant={bucket.tone === 'danger' ? 'danger' : bucket.tone === 'warning' ? 'warning' : 'neutral'} size="md">
                {bucket.count}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
