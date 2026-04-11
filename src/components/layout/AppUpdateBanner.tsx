import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  isApplyingUpdate: boolean;
  applyError: boolean;
  onApplyUpdate: () => void;
  onDismiss: () => void;
}

export function AppUpdateBanner({
  isApplyingUpdate,
  applyError,
  onApplyUpdate,
  onDismiss,
}: Props) {
  return (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50/90 px-4 py-3 text-amber-950 backdrop-blur dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">A new version of Pulsar is available.</p>
            <p className="text-sm text-amber-800/90 dark:text-amber-100/80">
              Refresh to load the latest app bundle without losing your saved settings.
            </p>
            {applyError && (
              <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
                Refresh didn&apos;t complete cleanly. Try again, or use a hard refresh with{' '}
                <span className="font-medium">Cmd/Ctrl+Shift+R</span>.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="btn-ghost px-3 py-2 text-amber-900 hover:bg-amber-100/80 dark:text-amber-100 dark:hover:bg-amber-900/40"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onApplyUpdate}
            disabled={isApplyingUpdate}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700',
              isApplyingUpdate && 'cursor-wait opacity-80'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', isApplyingUpdate && 'animate-spin')} />
            {isApplyingUpdate ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </div>
    </div>
  );
}
