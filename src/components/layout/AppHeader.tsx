import { useSettingsStore } from '../../store/settings';
import { cn } from '../../lib/utils';
import { useRefreshCountdown } from '../../hooks/useRefreshCountdown';
import { capture } from '../../lib/analytics';
import {
  Settings,
  RefreshCw,
  Maximize2,
  Minimize2,
  GitPullRequest,
  Moon,
  Sun,
  AlertCircle,
  BarChart3,
  List,
  Activity,
} from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { format } from 'date-fns';

export type AppPage = 'prs' | 'dashboard' | 'api';

interface Props {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
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

const NAV_ITEMS: { id: AppPage; label: string; icon: React.ReactNode }[] = [
  { id: 'prs', label: 'Pull Requests', icon: <List className="h-3.5 w-3.5" /> },
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: 'api', label: 'API Limits', icon: <Activity className="h-3.5 w-3.5" /> },
];

export function AppHeader({
  page,
  onNavigate,
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
  const { darkMode, toggleDarkMode, timeRange, refreshIntervalMinutes } = useSettingsStore();
  const countdown = useRefreshCountdown(lastUpdated, refreshIntervalMinutes);

  const timeRangeLabel: Record<string, string> = {
    '7d': '7d', '14d': '14d', '30d': '30d', '60d': '60d', '90d': '90d',
  };

  return (
    <header className="h-14 flex items-center gap-0 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-5">
        <div className="p-1.5 bg-brand-600 rounded-lg">
          <GitPullRequest className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight hidden sm:block">
          Pulsar
        </span>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center gap-1 mr-4">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { onNavigate(id); capture('page_viewed', { page: id }); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              page === id
                ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      <span className="hidden md:block text-xs text-slate-300 dark:text-slate-700 mr-4">|</span>
      <span className="hidden md:block text-xs text-slate-400 mr-auto">
        Last {timeRangeLabel[timeRange] ?? timeRange}
      </span>

      {/* Status area */}
      <div className="flex items-center gap-2 ml-auto">
        {isError && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 px-3 py-1 rounded-full">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Error fetching data</span>
          </div>
        )}
        {(isLoading || isFetching) && progress && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full max-w-52 truncate">
            <Spinner size="sm" className="h-3 w-3" />
            <span className="truncate">{progress}</span>
          </div>
        )}
        {lastUpdated && !isFetching && (
          <span className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400">
            {format(lastUpdated, 'HH:mm')}
            {countdown && (
              <span className="text-slate-300 dark:text-slate-600" title="Next refresh in">
                · in {countdown}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 ml-2">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={cn('btn-ghost p-2', isLoading && 'opacity-50 cursor-not-allowed')}
          title="Refresh"
          type="button"
        >
          {isFetching ? <Spinner size="sm" className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
        </button>
        <button onClick={toggleDarkMode} className="btn-ghost p-2" type="button" title="Toggle theme">
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button onClick={onToggleFullscreen} className="btn-ghost p-2" type="button">
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button onClick={onOpenSettings} className="btn-ghost p-2" type="button" title="Settings">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
