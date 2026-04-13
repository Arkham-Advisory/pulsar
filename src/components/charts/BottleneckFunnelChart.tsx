import { useState } from 'react';
import type { BottleneckPhaseData } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { formatDuration } from '../../lib/metrics';
import { TrendingDown } from 'lucide-react';

interface Props {
  data: BottleneckPhaseData[];
  loading?: boolean;
}

function getDelayColor(hours: number, maxHours: number): string {
  const ratio = maxHours <= 0 ? 0 : hours / maxHours;
  if (ratio >= 0.85) return '#ef4444';
  if (ratio >= 0.55) return '#f59e0b';
  return '#38bdf8';
}

export function BottleneckFunnelChart({ data, loading }: Props) {
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);
  const hasData = data.some((d) => d.count > 0);
  const phases = data.filter((phase) => phase.count > 0);
  const bottleneck = phases.reduce<BottleneckPhaseData | null>(
    (currentMax, phase) => {
      if (!currentMax || phase.avgHours > currentMax.avgHours) return phase;
      return currentMax;
    },
    null
  );
  const totalHours = phases.reduce((sum, phase) => sum + phase.avgHours, 0);
  const maxCount = Math.max(...phases.map((phase) => phase.count), 1);
  const maxHours = Math.max(...phases.map((phase) => phase.avgHours), 1);
  const activePhase = phases.find((phase) => phase.phase === hoveredPhase) ?? bottleneck ?? phases[0] ?? null;

  return (
    <Card>
      <CardHeader
        title="Bottleneck Funnel"
        subtitle="Avg time lost per phase (merged PRs)"
        icon={<TrendingDown className="h-4 w-4" />}
      />
      {loading ? (
        <div className="h-56 skeleton rounded-lg" />
      ) : !hasData ? (
        <div className="h-56 flex items-center justify-center text-sm text-slate-400">
          Not enough merged PR data
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <svg width="100%" height="220" viewBox="0 0 760 220" className="min-w-[760px]">
              {phases.map((phase, index) => {
                const next = phases[index + 1];
                const x = 30 + index * 240;
                const width = 140;
                const bandHeight = Math.max((phase.count / maxCount) * 80, 24);
                const y = 110 - bandHeight / 2;
                const fill = getDelayColor(phase.avgHours, maxHours);
                const isBottleneck = bottleneck?.phase === phase.phase;
                const isActive = hoveredPhase === null || hoveredPhase === phase.phase;

                return (
                  <g
                    key={phase.phase}
                    onMouseEnter={() => setHoveredPhase(phase.phase)}
                    onMouseLeave={() => setHoveredPhase(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={bandHeight}
                      rx={16}
                      fill={fill}
                      fillOpacity={isActive ? (isBottleneck ? 0.95 : 0.82) : 0.2}
                      stroke={isBottleneck ? '#ef4444' : 'transparent'}
                      strokeWidth={isBottleneck ? 3 : 0}
                    />
                    <text x={x + 16} y={y - 12} fontSize="12" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                      {phase.phase}
                    </text>
                    <text x={x + 16} y={y + bandHeight / 2} fontSize="18" fill="white" fontWeight="700">
                      {formatDuration(phase.avgHours)}
                    </text>
                    <text x={x + 16} y={y + bandHeight / 2 + 18} fontSize="11" fill="rgba(255,255,255,0.92)">
                      {phase.count} PRs
                    </text>
                    {next && (
                      <path
                        d={`M ${x + width} ${110 - bandHeight / 2} C ${x + 180} ${110 - bandHeight / 2}, ${x + 200} ${110 - Math.max((next.count / maxCount) * 80, 24) / 2}, ${x + 240} ${110 - Math.max((next.count / maxCount) * 80, 24) / 2}
                            L ${x + 240} ${110 + Math.max((next.count / maxCount) * 80, 24) / 2}
                            C ${x + 200} ${110 + Math.max((next.count / maxCount) * 80, 24) / 2}, ${x + 180} ${110 + bandHeight / 2}, ${x + width} ${110 + bandHeight / 2} Z`}
                        fill={fill}
                        fillOpacity={isActive ? 0.22 : 0.08}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {activePhase && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{activePhase.phase}</span>{' '}
                averages {formatDuration(activePhase.avgHours)} across {activePhase.count} merged PRs.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Total average journey: {formatDuration(totalHours)}. Warmer colors mean longer waits.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
