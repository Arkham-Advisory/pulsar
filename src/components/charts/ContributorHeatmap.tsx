import { useMemo } from 'react';
import { format, eachDayOfInterval } from 'date-fns';
import { cn } from '../../lib/utils';
import { useSettingsStore } from '../../store/settings';
import type { HeatmapContributor } from '../../types/github';

interface Props {
  data: HeatmapContributor[];
  since: Date;
  loading?: boolean;
}

type RGB = [number, number, number];

function lerpRGB(from: RGB, to: RGB, t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r},${g},${b})`;
}

// Saturates at 5 activities — smooth lerp between a pale tint and the full hue
const PALETTES = {
  light: {
    empty:   [241, 245, 249] as RGB, // slate-100
    reviews: { from: [219, 234, 254] as RGB, to: [29,  78,  216] as RGB }, // blue-100 → blue-700
    merges:  { from: [237, 233, 254] as RGB, to: [109, 40,  217] as RGB }, // violet-100 → violet-700
    mixed:   { from: [220, 252, 231] as RGB, to: [21,  128, 61 ] as RGB }, // green-100 → green-700
  },
  dark: {
    empty:   [30, 41, 59] as RGB,   // slate-800
    // dark mode: barely tinted (close to bg) → vivid saturated mid-tone
    // low activity blends into the background; high activity pops
    reviews: { from: [30,  50,  80 ] as RGB, to: [59,  130, 246] as RGB }, // ~bg → blue-500
    merges:  { from: [45,  30,  70 ] as RGB, to: [139, 92,  246] as RGB }, // ~bg → violet-500
    mixed:   { from: [25,  52,  35 ] as RGB, to: [34,  197, 94 ] as RGB }, // ~bg → green-500
  },
};

function getCellStyle(reviews: number, merges: number, isDark: boolean): React.CSSProperties {
  const p = isDark ? PALETTES.dark : PALETTES.light;
  const total = reviews + merges;
  if (total === 0) return { backgroundColor: `rgb(${p.empty.join(',')})` };
  const t = Math.min(total / 5, 1);
  const def = reviews > 0 && merges > 0 ? p.mixed : merges > 0 ? p.merges : p.reviews;
  return { backgroundColor: lerpRGB(def.from, def.to, t) };
}

export function ContributorHeatmap({ data, since, loading = false }: Props) {
  const { darkMode } = useSettingsStore();
  const days = useMemo(
    () => eachDayOfInterval({ start: since, end: new Date() }),
    [since]
  );

  // Week buckets for column labels (every 7 days)
  const weekLabels = useMemo(() => {
    const labels: { idx: number; label: string }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      labels.push({ idx: i, label: format(days[i], 'MMM d') });
    }
    return labels;
  }, [days]);

  const dayKeys = useMemo(() => days.map((d) => format(d, 'yyyy-MM-dd')), [days]);

  if (loading) {
    return (
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center text-sm text-slate-400">
        No contributor activity in the selected period.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contributor Heatmap</h3>
        <p className="text-xs text-slate-400 mt-0.5">Daily reviews &amp; merges per contributor</p>
      </div>

      <div className="p-4 bg-white dark:bg-slate-900 overflow-x-auto">
        {/* Day labels */}
        <div className="flex items-end mb-1" style={{ paddingLeft: '120px' }}>
          <div className="flex gap-px flex-1 relative">
            {weekLabels.map(({ idx, label }) => (
              <div
                key={idx}
                className="absolute text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap"
                style={{ left: `${(idx / days.length) * 100}%` }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-1">
          {data.map((contributor) => (
            <div key={contributor.login} className="flex items-center gap-2">
              {/* Contributor label */}
              <div className="w-[120px] flex items-center gap-1.5 shrink-0 pr-2">
                <img
                  src={contributor.avatar_url}
                  alt={contributor.login}
                  className="w-5 h-5 rounded-full shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-400 truncate" title={contributor.login}>
                  {contributor.login}
                </span>
              </div>

              {/* Day cells */}
              <div className="flex gap-px flex-1">
                {dayKeys.map((key) => {
                  const activity = contributor.days[key];
                  const reviews = activity?.reviews ?? 0;
                  const merges = activity?.merges ?? 0;
                  const total = reviews + merges;
                  return (
                    <div
                      key={key}
                      title={
                        total > 0
                          ? `${contributor.login} on ${key}: ${reviews} review${reviews !== 1 ? 's' : ''}, ${merges} merge${merges !== 1 ? 's' : ''}`
                          : undefined
                      }
                      className={cn(
                        'flex-1 h-5 rounded-[2px] transition-opacity cursor-default',
                        total > 0 ? 'hover:opacity-80' : '',
                      )}
                    style={getCellStyle(reviews, merges, darkMode)}
                    />
                  );
                })}
              </div>

              {/* Total badge */}
              <div className="w-8 text-right shrink-0">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {contributor.totalActivity}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Legend</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-[2px]" style={getCellStyle(5, 0, darkMode)} />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Reviews</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-[2px]" style={getCellStyle(0, 5, darkMode)} />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Merges</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-[2px]" style={getCellStyle(3, 2, darkMode)} />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Both</span>
          </div>
        </div>
      </div>
    </div>
  );
}
