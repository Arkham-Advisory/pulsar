import type { HotspotItem } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { AlertOctagon, ExternalLink } from 'lucide-react';
import { truncate } from '../../lib/utils';

interface Props {
  items: HotspotItem[];
  loading?: boolean;
}

export function HotspotPriorityQueueCard({ items, loading }: Props) {
  return (
    <Card>
      <CardHeader
        title="Hotspot Priority Queue"
        subtitle="Ranked by urgency so the team knows where to act first"
        icon={<AlertOctagon className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-400">
          No hotspots right now
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {truncate(item.title, 70)}
                  </p>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors group-hover:text-brand-500" />
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  <a
                    href={item.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="underline-offset-2 hover:text-brand-600 hover:underline dark:hover:text-brand-400"
                  >
                    {item.repoLabel}
                  </a>
                  <span>{` · ${item.ownerLogin}`}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : 'neutral'}>
                    {item.reason}
                  </Badge>
                  <span className="text-xs text-slate-400">{item.ageLabel}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
