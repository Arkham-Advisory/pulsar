import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { PRRow } from './PRRow';
import { useSettingsStore } from '../../store/settings';
import { capture } from '../../lib/analytics';
import type { PullRequest } from '../../types/github';
import type { ApprovalStatus } from '../../services/github';

const PAGE_SIZE = 30;

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  prs: PullRequest[];
  ciStatuses?: Map<number, PullRequest['ciStatus']>;
  approvalStatuses?: Map<number, ApprovalStatus>;
  conflictStatuses?: Map<number, boolean>;
  sizeTotals?: Map<number, number>;
  defaultOpen?: boolean;
  showRepo?: boolean;
  accent?: 'red' | 'amber' | 'green' | 'blue' | 'slate';
  emptyMessage?: string;
  onSelectPR?: (pr: PullRequest) => void;
}

const ACCENT_ICON: Record<string, string> = {
  red:   'text-red-500 dark:text-red-400',
  amber: 'text-amber-500 dark:text-amber-400',
  green: 'text-green-500 dark:text-green-400',
  blue:  'text-blue-500 dark:text-blue-400',
  slate: 'text-slate-400',
};

const ACCENT_BADGE: Record<string, string> = {
  red:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  blue:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export function PRSection({
  id,
  title,
  subtitle,
  icon,
  prs,
  ciStatuses,
  approvalStatuses,
  conflictStatuses,
  sizeTotals,
  defaultOpen = true,
  showRepo = true,
  accent = 'slate',
  emptyMessage,
  onSelectPR,
}: Props) {
  const { sectionOpen, setSectionOpen } = useSettingsStore();
  const open = id in sectionOpen ? sectionOpen[id] : defaultOpen;
  const [page, setPage] = useState(1);

  if (prs.length === 0) return null;

  const visible = prs.slice(0, page * PAGE_SIZE);
  const hasMore = prs.length > visible.length;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => { setSectionOpen(id, !open); capture('section_toggled', { section_id: id, open: !open }); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        }
        <span className={ACCENT_ICON[accent]}>{icon}</span>
        <span className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal leading-tight">
              {subtitle}
            </span>
          )}
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={prs.length}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', ACCENT_BADGE[accent])}
          >
            {prs.length}
          </motion.span>
        </AnimatePresence>
      </button>

      {/* Section body: column headers + rows — animated open/close */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {/* Column headers */}
            {prs.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                <div className="w-4 shrink-0" />
              {showRepo && <div className="w-48 hidden md:block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Repo</div>}
              {!showRepo && <div className="w-16 hidden md:block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">#</div>}
              <div className="flex-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Title</div>
              <div className="hidden sm:block w-14 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Size</div>
                <div className="hidden sm:block w-28 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Author</div>
                <div className="hidden md:block w-16 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Reviewers</div>
                <div className="w-16 text-right text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Updated</div>
              </div>
            )}

            {/* PR rows */}
            <div className="bg-white dark:bg-slate-900">
              {prs.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-400">
                  {emptyMessage ?? 'No pull requests'}
                </div>
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {visible.map((pr) => (
                      <motion.div
                        key={pr.id}
                        layout="position"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      >
                        <PRRow
                          pr={pr}
                          ciStatus={ciStatuses?.get(pr.id)}
                          approvalStatus={approvalStatuses?.get(pr.id)}
                          hasConflict={conflictStatuses?.get(pr.id) === true}
                          sizeTotal={sizeTotals?.get(pr.id)}
                          showRepo={showRepo}
                          section={id}
                          onSelect={onSelectPR ? () => onSelectPR(pr) : undefined}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {hasMore && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setPage((p) => p + 1); }}
                      className="w-full py-3 text-xs text-brand-600 dark:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-t border-slate-100 dark:border-slate-800"
                    >
                      Show {Math.min(PAGE_SIZE, prs.length - visible.length)} more
                      <span className="text-slate-400 ml-1">({prs.length - visible.length} remaining)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
