import { useState } from 'react';
import type { WeeklyDigest } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { formatDuration } from '../../lib/metrics';
import { CalendarDays, Copy, Check, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  digest: WeeklyDigest | null;
  loading?: boolean;
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0) return <span className="text-slate-400 text-xs">—</span>;
  const delta = current - prev;
  if (delta > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400 font-medium">
        <TrendingUp className="h-3 w-3" />+{delta} vs prev week
      </span>
    );
  if (delta < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-red-500 dark:text-red-400 font-medium">
        <TrendingDown className="h-3 w-3" />{delta} vs prev week
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-slate-400 font-medium">
      <Minus className="h-3 w-3" />same as prev week
    </span>
  );
}

function buildCopyText(d: WeeklyDigest): string {
  return [
    `📊 Weekly PR Digest — ${d.weekLabel}`,
    ``,
    `✅ Merged: ${d.merges} PRs (prev week: ${d.prevWeekMerges})`,
    `🔓 Open: ${d.openCount} PRs${d.draftCount > 0 ? ` (${d.draftCount} drafts)` : ''}`,
    `⏱ Avg cycle time: ${formatDuration(d.avgCycleTimeHours)}`,
    `👀 Avg time to 1st review: ${formatDuration(d.avgTimeToFirstReviewHours)}`,
  ].join('\n');
}

export function WeeklyDigestCard({ digest, loading }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!digest) return;
    await navigator.clipboard.writeText(buildCopyText(digest));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader
        title="Weekly Digest"
        subtitle={digest ? digest.weekLabel : 'Last 7 days snapshot'}
        icon={<CalendarDays className="h-4 w-4" />}
        action={
          digest && !loading ? (
            <button
              onClick={handleCopy}
              title="Copy digest as text"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          ) : undefined
        }
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 skeleton rounded-lg" />
          ))}
        </div>
      ) : !digest ? (
        <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
          No data available
        </div>
      ) : (
        <div className="space-y-3">
          {/* Merged */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Merged this week</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {digest.merges}
              </p>
            </div>
            <div className="text-right pt-1">
              <TrendBadge current={digest.merges} prev={digest.prevWeekMerges} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Open count */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-0.5">Open PRs</p>
              <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
                {digest.openCount}
              </p>
              {digest.draftCount > 0 && (
                <p className="text-xs text-slate-400">{digest.draftCount} drafts</p>
              )}
            </div>

            {/* Cycle time */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-0.5">Avg cycle time</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">
                {formatDuration(digest.avgCycleTimeHours)}
              </p>
            </div>

            {/* Time to first review */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 col-span-2">
              <p className="text-xs text-slate-400 mb-0.5">Avg time to first review</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">
                {formatDuration(digest.avgTimeToFirstReviewHours)}
              </p>
            </div>
          </div>

          {/* Copyable standup text preview */}
          <div className="mt-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-900/30">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Standup / Slack snippet</p>
            <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed select-all">
              {buildCopyText(digest)}
            </pre>
          </div>
        </div>
      )}
    </Card>
  );
}
