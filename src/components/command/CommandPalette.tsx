import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, CornerDownLeft, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CommandGroupId, CommandItem } from '../../types/commandPalette';

interface Props {
  commands: CommandItem[];
  onClose: () => void;
  onCommandRun: (command: CommandItem, query: string) => void;
  onZeroResults?: (query: string) => void;
}

const GROUP_LABELS: Record<CommandGroupId, string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  filters: 'Filters',
  presets: 'Presets',
  pull_requests: 'Pull Requests',
};

const GROUP_ORDER: CommandGroupId[] = ['navigation', 'actions', 'filters', 'presets', 'pull_requests'];

function getCommandText(command: CommandItem): string {
  return [
    command.title,
    command.subtitle,
    ...(command.keywords ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function getGroupRank(group: CommandGroupId): number {
  return GROUP_ORDER.indexOf(group);
}

function getCommandRank(command: CommandItem, query: string): number | null {
  if (!query) {
    if (command.group === 'pull_requests') return null;
    return 1000 - getGroupRank(command.group) * 100;
  }

  const normalized = query.toLowerCase().trim();
  const haystack = getCommandText(command);
  const title = command.title.toLowerCase();
  const subtitle = command.subtitle?.toLowerCase() ?? '';

  if (title === normalized) return 10_000 - getGroupRank(command.group) * 100;
  if (title.startsWith(normalized)) return 8_000 - getGroupRank(command.group) * 100;
  if ((command.keywords ?? []).some((keyword) => keyword.toLowerCase() === normalized)) {
    return 7_200 - getGroupRank(command.group) * 100;
  }
  if (title.includes(normalized)) return 6_400 - getGroupRank(command.group) * 100;
  if (subtitle.includes(normalized)) return 5_600 - getGroupRank(command.group) * 100;

  const terms = normalized.split(/\s+/).filter(Boolean);
  if (terms.length > 0 && terms.every((term) => haystack.includes(term))) {
    return 4_800 - getGroupRank(command.group) * 100 - haystack.length / 1000;
  }

  if (haystack.includes(normalized)) return 4_000 - getGroupRank(command.group) * 100;

  return null;
}

export function CommandPalette({ commands, onClose, onCommandRun, onZeroResults }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const rankedCommands = useMemo(() => {
    return commands
      .map((command) => ({ command, score: getCommandRank(command, query) }))
      .filter((entry): entry is { command: CommandItem; score: number } => entry.score !== null)
      .sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title));
  }, [commands, query]);

  const visibleCommands = useMemo(() => rankedCommands.map((entry) => entry.command), [rankedCommands]);

  const groupedCommands = useMemo(() => {
    return GROUP_ORDER
      .map((group) => ({
        group,
        label: GROUP_LABELS[group],
        items: visibleCommands.filter((command) => command.group === group),
      }))
      .filter((group) => group.items.length > 0);
  }, [visibleCommands]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim() || visibleCommands.length > 0) return;
    onZeroResults?.(query);
  }, [onZeroResults, query, visibleCommands.length]);

  const activeIndex = Math.min(selectedIndex, Math.max(visibleCommands.length - 1, 0));

  const runSelected = () => {
    const command = visibleCommands[activeIndex];
    if (!command) return;
    onCommandRun(command, query);
    command.perform(query);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-[10vh] w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex((current) => Math.min(current + 1, Math.max(visibleCommands.length - 1, 0)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                runSelected();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Search commands, filters, PRs..."
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <div className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:flex">
            <CornerDownLeft className="h-3 w-3" />
            Run
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-2">
          {groupedCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Command className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No results for “{query}”</p>
              <p className="text-xs text-slate-400">Try a page name, repo, reviewer, or PR number.</p>
            </div>
          ) : (
            groupedCommands.map((group) => (
              <div key={group.group} className="py-1">
                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((command) => {
                    const absoluteIndex = visibleCommands.findIndex((item) => item.id === command.id);
                    const active = absoluteIndex === activeIndex;
                    return (
                      <button
                        key={command.id}
                        type="button"
                        onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                        onClick={() => {
                          onCommandRun(command, query);
                          command.perform(query);
                          onClose();
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
                          active
                            ? 'bg-brand-50 text-slate-900 dark:bg-brand-950/40 dark:text-slate-50'
                            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80',
                        )}
                      >
                        <div className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold',
                          active
                            ? 'border-brand-200 bg-white text-brand-600 dark:border-brand-800 dark:bg-slate-900 dark:text-brand-300'
                            : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500',
                        )}>
                          {absoluteIndex + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{command.title}</div>
                          {command.subtitle && (
                            <div className="truncate text-xs text-slate-400 dark:text-slate-500">{command.subtitle}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
