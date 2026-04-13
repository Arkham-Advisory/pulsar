import { useState } from 'react';
import type { FlowStateNode } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { GitBranchPlus } from 'lucide-react';

interface Props {
  nodes: FlowStateNode[];
  loading?: boolean;
}

const NODE_STYLES: Record<FlowStateNode['tone'], string> = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border-brand-200 dark:border-brand-900/50',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
  danger: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-900/50',
  success: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300 border-green-200 dark:border-green-900/50',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

export function FlowStateGraphCard({ nodes, loading }: Props) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const maxCount = Math.max(...nodes.map((node) => node.count), 1);

  return (
    <Card>
      <CardHeader
        title="Flow State Graph"
        subtitle="Where pull request volume is accumulating right now"
        icon={<GitBranchPlus className="h-4 w-4" />}
      />
      {loading ? (
        <div className="h-56 skeleton rounded-xl" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr,1fr,1fr,1fr,1.1fr]">
            {nodes.map((node, index) => (
              <div key={node.label} className="flex items-center gap-2">
                <div
                  className={`flex-1 rounded-2xl border p-4 ${NODE_STYLES[node.tone]} ${hoveredLabel && hoveredLabel !== node.label ? 'opacity-40' : ''}`}
                  onMouseEnter={() => setHoveredLabel(node.label)}
                  onMouseLeave={() => setHoveredLabel(null)}
                >
                  <p className="text-xs uppercase tracking-wide opacity-80">{node.label}</p>
                  <p className="mt-2 text-2xl font-bold">{node.count}</p>
                </div>
                {index < nodes.length - 1 && (
                  <div className="hidden xl:block text-slate-300 dark:text-slate-700">→</div>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {nodes.slice(1).map((node) => (
              <div key={node.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{node.label}</span>
                  <span>{Math.round((node.count / maxCount) * 100)}% of busiest stage</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-2 rounded-full ${
                      node.tone === 'warning'
                        ? 'bg-amber-500'
                        : node.tone === 'danger'
                          ? 'bg-red-500'
                          : node.tone === 'success'
                            ? 'bg-green-500'
                            : node.tone === 'brand'
                              ? 'bg-brand-500'
                              : 'bg-slate-500'
                    }`}
                    style={{ width: `${Math.max((node.count / maxCount) * 100, node.count > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
