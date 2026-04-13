import { useState } from 'react';
import type { HotspotCascadeRepo } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Orbit } from 'lucide-react';

interface Props {
  data: HotspotCascadeRepo[];
  loading?: boolean;
}

export function HotspotCascadeCard({ data, loading }: Props) {
  const [hoveredRepo, setHoveredRepo] = useState<string | null>(null);
  const [hoveredReason, setHoveredReason] = useState<string | null>(null);
  const maxReason = Math.max(
    ...data.flatMap((repo) => repo.reasons.map((reason) => reason.count)),
    1
  );

  return (
    <Card>
      <CardHeader
        title="Hotspot Cascade"
        subtitle="Which repos are generating multiple problem patterns at once"
        icon={<Orbit className="h-4 w-4" />}
      />
      {loading ? (
        <div className="h-64 skeleton rounded-xl" />
      ) : data.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-slate-400">
          No cascading hotspots right now
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((repo) => (
            <div
              key={repo.repo}
              className={`rounded-2xl border border-slate-100 p-3 dark:border-slate-800 ${hoveredRepo && hoveredRepo !== repo.repo ? 'opacity-45' : ''}`}
              onMouseEnter={() => setHoveredRepo(repo.repo)}
              onMouseLeave={() => setHoveredRepo(null)}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <a
                  href={repo.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-slate-800 underline-offset-2 hover:text-brand-600 hover:underline dark:text-slate-200 dark:hover:text-brand-400"
                >
                  {repo.repo}
                </a>
                <span className="text-xs text-slate-400">{repo.total} active hotspot PRs</span>
              </div>
              <div className="space-y-2">
                {repo.reasons.map((reason) => (
                  <div key={`${repo.repo}-${reason.label}`} className="grid grid-cols-[120px,1fr,40px] items-center gap-3 text-xs">
                    <span
                      className="text-slate-500 dark:text-slate-400"
                      onMouseEnter={() => setHoveredReason(`${repo.repo}-${reason.label}`)}
                      onMouseLeave={() => setHoveredReason(null)}
                    >
                      {reason.label}
                    </span>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-2 rounded-full ${
                          reason.tone === 'danger' ? 'bg-red-500' : reason.tone === 'warning' ? 'bg-amber-500' : 'bg-slate-500'
                        }`}
                        style={{ width: `${Math.max((reason.count / maxReason) * 100, 8)}%`, opacity: !hoveredReason || hoveredReason === `${repo.repo}-${reason.label}` ? 1 : 0.35 }}
                      />
                    </div>
                    <span className="text-right font-semibold text-slate-700 dark:text-slate-300">{reason.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
