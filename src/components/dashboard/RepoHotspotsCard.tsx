import type { RepoHotspot } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Flame } from 'lucide-react';

interface Props {
  hotspots: RepoHotspot[];
  loading?: boolean;
}

export function RepoHotspotsCard({ hotspots, loading }: Props) {
  return (
    <Card>
      <CardHeader
        title="Repo Hotspots"
        subtitle="Repositories accumulating the most review and delivery pressure"
        icon={<Flame className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : hotspots.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          No repository hotspots right now
        </div>
      ) : (
        <div className="space-y-2">
          {hotspots.map((hotspot) => (
            <div key={hotspot.repo} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <a
                  href={hotspot.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-slate-800 underline-offset-2 hover:text-brand-600 hover:underline dark:text-slate-200 dark:hover:text-brand-400"
                >
                  {hotspot.repo}
                </a>
                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                  score {hotspot.totalScore}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  {hotspot.waitingReview} waiting
                </div>
                <div className="rounded-lg bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {hotspot.stale} stale
                </div>
                <div className="rounded-lg bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  {hotspot.failingCi} failing CI
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
