import { useMemo } from 'react';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { cn } from '../../lib/utils';

interface Milestone {
  key: string;
  label: string;
  at: string | null;
  color: string;
  dotColor: string;
}

interface Props {
  openedAt: string;
  firstCommitAt: string | null;
  firstReviewAt: string | null;
  firstReviewUser: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  mergedAt: string | null;
}

function formatGap(fromISO: string, toISO: string): string {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const mins = differenceInMinutes(to, from);
  if (mins < 60) return `${mins}m`;
  const hrs = differenceInHours(to, from);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function PRLifecycleTimeline({
  openedAt,
  firstCommitAt,
  firstReviewAt,
  firstReviewUser,
  approvedAt,
  approvedBy,
  mergedAt,
}: Props) {
  const milestones: Milestone[] = useMemo(() => [
    {
      key: 'opened',
      label: 'Opened',
      at: openedAt,
      color: 'text-slate-500 dark:text-slate-400',
      dotColor: 'bg-slate-400 dark:bg-slate-500',
    },
    ...(firstCommitAt && firstCommitAt !== openedAt
      ? [{
          key: 'commit',
          label: 'First Commit',
          at: firstCommitAt,
          color: 'text-slate-500 dark:text-slate-400',
          dotColor: 'bg-indigo-400 dark:bg-indigo-500',
        }]
      : []),
    ...(firstReviewAt
      ? [{
          key: 'review',
          label: firstReviewUser ? `Reviewed by @${firstReviewUser}` : 'First Review',
          at: firstReviewAt,
          color: 'text-blue-600 dark:text-blue-400',
          dotColor: 'bg-blue-500',
        }]
      : []),
    ...(approvedAt
      ? [{
          key: 'approved',
          label: approvedBy ? `Approved by @${approvedBy}` : 'Approved',
          at: approvedAt,
          color: 'text-green-600 dark:text-green-400',
          dotColor: 'bg-green-500',
        }]
      : []),
    ...(mergedAt
      ? [{
          key: 'merged',
          label: 'Merged',
          at: mergedAt,
          color: 'text-purple-600 dark:text-purple-400',
          dotColor: 'bg-purple-500',
        }]
      : []),
  ], [openedAt, firstCommitAt, firstReviewAt, firstReviewUser, approvedAt, approvedBy, mergedAt]);

  if (milestones.length < 2) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
        Lifecycle
      </h3>

      {/* Timeline track */}
      <div className="relative">
        {/* Horizontal connector line */}
        <div className="absolute top-[10px] left-2.5 right-2.5 h-px bg-slate-200 dark:bg-slate-700" />

        {/* Milestones */}
        <div className="relative flex items-start justify-between">
          {milestones.map((ms, idx) => (
            <div key={ms.key} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              {/* Dot */}
              <div
                title={ms.at ? format(new Date(ms.at), 'MMM d, yyyy HH:mm') : ''}
                className={cn(
                  'w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 z-10 flex items-center justify-center shrink-0',
                  ms.dotColor
                )}
              />

              {/* Gap label between dots */}
              {idx > 0 && milestones[idx - 1].at && ms.at && (
                <div
                  className="absolute text-[9px] text-slate-400 dark:text-slate-500"
                  style={{ top: '-14px', left: '0', right: '0', textAlign: 'center' }}
                />
              )}

              {/* Event name + date stacked below */}
              <div className="flex flex-col items-center gap-0.5 px-1 text-center min-w-0 w-full">
                <span className={cn('text-[10px] font-semibold leading-tight break-words w-full text-center', ms.color)}>
                  {ms.label}
                </span>
                {ms.at && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                    {format(new Date(ms.at), 'MMM d')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Gap annotations between milestone pairs */}
        <div className="flex mt-1">
          {milestones.map((ms, idx) => {
            if (idx === 0 || !milestones[idx - 1].at || !ms.at) return <div key={ms.key} className="flex-1" />;
            return (
              <div key={ms.key} className="flex-1 flex justify-center">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1 rounded">
                  +{formatGap(milestones[idx - 1].at!, ms.at)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
