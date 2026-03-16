import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  message?: string;
  onRetry: () => void;
}

export function QueryError({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
      <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-2xl">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Failed to load data</p>
        <p className="mt-1 text-xs text-slate-400 max-w-sm">
          {message ?? 'Could not reach GitHub. Check your network connection or PAT permissions.'}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}
