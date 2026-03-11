import { useSettingsStore } from '../../store/settings';
import { cn } from '../../lib/utils';
import {
  Settings,
  RefreshCw,
  Maximize2,
  Minimize2,
  GitPullRequest,
  Moon,
  Sun,
  AlertCircle,
} from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { format } from 'date-fns';

interface Props {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRefresh: () => void;
  lastUpdated: Date | null;
  progress?: string;
}

export function DashboardHeader({
  isFullscreen,
  onToggleFullscreen,
  onOpenSettings,
  isLoading,
  isFetching,
  isError,
  onRefresh,
  lastUpdated,
  progress,
}: Props) {
  const { darkMode, toggleDarkMode, timeRange } = useSettingsStore();

  const timeRangeLabel = {
    '7d': 'Last 7 days',
    '14d': 'Last 14 days',
    '30d': 'Last 30 days',
    '60d': 'Last 60 days',
    '90d': 'Last 90 days',
  }[timeRange] || timeRange;

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand-600 rounded-lg">
            <GitPullRequest className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
            Pulsar
          </span>
        </div>
        <span className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <span className="hidden sm:block text-xs text-slate-400">{timeRangeLabel}</span>
      </div>

      {/* Center: Status */}
      <div className="flex items-center gap-2">
        {isError && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 px-3 py-1 rounded-full">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Error fetching data</span>
          </div>
        )}
        {(isLoading || isFetching) && progress && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full max-w-64 truncate">
            <Spinner size="sm" className="h-3 w-3" />
            <span className="truncate">{progress}</span>
          </div>
        )}
        {lastUpdated && !isFetching && (
          <span className="hidden md:block text-xs text-slate-400">
            Updated {format(lastUpdated, 'HH:mm')}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={cn('btn-ghost', isLoading && 'opacity-50 cursor-not-allowed')}
          title="Refresh data"
          type="button"
        >
          {isFetching ? (
            <Spinner size="sm" className="h-4 w-4" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={toggleDarkMode}
          className="btn-ghost"
          title="Toggle dark mode"
          type="button"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={onToggleFullscreen}
          className="btn-ghost"
          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          type="button"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={onOpenSettings}
          className="btn-ghost"
          title="Settings"
          type="button"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
