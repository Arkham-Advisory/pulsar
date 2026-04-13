import { useState } from 'react';
import type { MergeReadinessBucket } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Radar } from 'lucide-react';

interface Props {
  buckets: MergeReadinessBucket[];
  loading?: boolean;
}

export function MergeReadinessRadarCard({ buckets, loading }: Props) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const total = Math.max(buckets.reduce((sum, bucket) => sum + bucket.count, 0), 1);

  return (
    <Card>
      <CardHeader
        title="Merge Readiness Radar"
        subtitle="What is close to merge versus what is still blocked"
        icon={<Radar className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40">
            <div
              className="h-48 w-48 rounded-full"
              style={{
                background: (() => {
                  let offset = 0;
                  const segments = buckets.map((bucket) => {
                    const size = (bucket.count / total) * 360;
                    const color = bucket.tone === 'success'
                      ? '#22c55e'
                      : bucket.tone === 'warning'
                        ? '#f59e0b'
                        : bucket.tone === 'danger'
                          ? '#ef4444'
                          : '#64748b';
                    const start = offset;
                    offset += size;
                    return `${color} ${start}deg ${offset}deg`;
                  });
                  return `conic-gradient(${segments.join(', ')})`;
                })(),
              }}
            >
              <div className="mx-auto mt-6 flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white text-center dark:bg-slate-950">
                <p className="text-xs uppercase tracking-wide text-slate-400">Open PRs</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{total}</p>
                <p className="mt-1 text-xs text-slate-400">readiness snapshot</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {buckets.map((bucket) => (
              <div
                key={bucket.label}
                className={`rounded-xl border border-slate-100 p-3 dark:border-slate-800 ${hoveredLabel && hoveredLabel !== bucket.label ? 'opacity-45' : ''}`}
                onMouseEnter={() => setHoveredLabel(bucket.label)}
                onMouseLeave={() => setHoveredLabel(null)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      bucket.tone === 'success'
                        ? 'bg-green-500'
                        : bucket.tone === 'warning'
                          ? 'bg-amber-500'
                          : bucket.tone === 'danger'
                            ? 'bg-red-500'
                            : 'bg-slate-500'
                    }`}
                  />
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{bucket.label}</p>
                </div>
                <p className="mt-1 text-xs text-slate-400">{bucket.description}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{bucket.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
