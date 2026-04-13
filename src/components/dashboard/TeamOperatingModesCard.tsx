import type { TeamOperatingModeRow } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Layers3 } from 'lucide-react';

interface Props {
  rows: TeamOperatingModeRow[];
  loading?: boolean;
}

const MODE_STYLES: Record<TeamOperatingModeRow['mode'], string> = {
  balanced: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300',
  'author-heavy': 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  'review-heavy': 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  'backlog-owner': 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300',
};

const MODE_HELPERS: Record<
  TeamOperatingModeRow['mode'],
  { title: string; description: string }
> = {
  balanced: {
    title: 'Balanced',
    description: 'Opening PRs and reviewing others at a fairly even pace.',
  },
  'author-heavy': {
    title: 'Author-heavy',
    description: 'Opening much more work than reviewing, so feedback load shifts to others.',
  },
  'review-heavy': {
    title: 'Review-heavy',
    description: 'Carrying more review work than authoring work in this window.',
  },
  'backlog-owner': {
    title: 'Backlog owner',
    description: 'Several PRs are still open, so this person currently owns a larger active queue.',
  },
};

export function TeamOperatingModesCard({ rows, loading }: Props) {
  const maxX = Math.max(...rows.map((row) => row.prsOpened), 1);
  const maxY = Math.max(...rows.map((row) => row.reviewsGiven), 1);
  const maxSize = Math.max(...rows.map((row) => row.openPRs), 1);

  return (
    <Card>
      <CardHeader
        title="Team Operating Modes"
        subtitle="How contributors are currently showing up in the delivery loop"
        icon={<Layers3 className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          No operating mode signals available
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <svg width="100%" height="260" viewBox="0 0 560 260" className="min-w-[560px]">
              <line x1="50" y1="220" x2="520" y2="220" stroke="rgba(148,163,184,0.5)" />
              <line x1="50" y1="220" x2="50" y2="24" stroke="rgba(148,163,184,0.5)" />
              <text x="520" y="238" textAnchor="end" fontSize="11" fill="currentColor" className="text-slate-400">
                PRs opened
              </text>
              <text x="16" y="30" fontSize="11" fill="currentColor" className="text-slate-400">
                Reviews given
              </text>
              {rows.map((row) => {
                const x = 60 + (row.prsOpened / maxX) * 440;
                const y = 210 - (row.reviewsGiven / maxY) * 170;
                const r = 12 + (row.openPRs / maxSize) * 10;
                const fill = row.mode === 'balanced'
                  ? '#22c55e'
                  : row.mode === 'author-heavy'
                    ? '#f59e0b'
                    : row.mode === 'review-heavy'
                      ? '#3b82f6'
                      : '#ef4444';
                return (
                  <g key={row.login}>
                    <circle cx={x} cy={y} r={r} fill={fill} fillOpacity="0.78" />
                    <text x={x} y={y - r - 8} textAnchor="middle" fontSize="11" fill="currentColor" className="text-slate-700 dark:text-slate-300">
                      {row.login}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(['balanced', 'author-heavy', 'review-heavy', 'backlog-owner'] as TeamOperatingModeRow['mode'][]).map((mode) => (
              <div key={mode} className="rounded-xl border border-slate-100 p-2.5 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MODE_STYLES[mode]}`}>
                    {MODE_HELPERS[mode].title}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{MODE_HELPERS[mode].description}</p>
              </div>
            ))}
          </div>

          {rows.map((row) => (
            <div key={row.login} className="rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={row.avatar_url} alt={row.login} className="h-6 w-6 rounded-full" />
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{row.login}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MODE_STYLES[row.mode]}`}>
                  {row.label}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {MODE_HELPERS[row.mode].description}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {row.prsOpened} PRs opened · {row.reviewsGiven} reviews given · {row.openPRs} still open
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
