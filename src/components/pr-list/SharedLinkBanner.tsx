import { AlertTriangle, CheckCircle2, Link2, Loader2, Settings, X } from 'lucide-react';
import type { RepoFilterEntry } from '../../types/settings';
import { cn } from '../../lib/utils';

function entryLabel(f: RepoFilterEntry): string {
  if (f.type === 'org') return `${f.owner} (org)`;
  if (f.type === 'prefix') return `${f.owner}/${f.prefix}*`;
  return `${f.owner}/${f.repo}`;
}

interface Props {
  hasPat: boolean;
  status: 'pending' | 'checking' | 'done';
  accessible: RepoFilterEntry[];
  inaccessible: RepoFilterEntry[];
  onOpenSettings: () => void;
  onDismiss: () => void;
}

export function SharedLinkBanner({
  hasPat,
  status,
  accessible,
  inaccessible,
  onOpenSettings,
  onDismiss,
}: Props) {
  const isWarning = !hasPat || (status === 'done' && inaccessible.length > 0);
  const isSuccess = status === 'done' && inaccessible.length === 0 && accessible.length > 0;
  const isChecking = hasPat && status === 'checking';

  return (
    <div
      className={cn(
        'shrink-0 flex items-start gap-3 px-5 py-3 text-sm border-b',
        isWarning
          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300'
          : isSuccess
            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/40 text-green-800 dark:text-green-300'
            : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300',
      )}
    >
      {/* Icon */}
      <span className="mt-0.5 shrink-0">
        {isChecking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isWarning ? (
          <AlertTriangle className="h-4 w-4" />
        ) : isSuccess ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
      </span>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-snug">Shared filter link</p>

        {!hasPat && (
          <p className="text-xs mt-0.5 opacity-80">
            This link includes repo configurations. Add your GitHub PAT in Settings to verify
            access and apply them.
          </p>
        )}

        {hasPat && status === 'pending' && (
          <p className="text-xs mt-0.5 opacity-80">Preparing to check repo access…</p>
        )}

        {hasPat && status === 'checking' && (
          <p className="text-xs mt-0.5 opacity-80">
            Checking access to repo configurations from the shared link…
          </p>
        )}

        {hasPat && status === 'done' && inaccessible.length > 0 && (
          <div className="text-xs mt-0.5 space-y-0.5">
            {accessible.length > 0 && (
              <p className="opacity-80">
                {accessible.length} repo source{accessible.length !== 1 ? 's' : ''} applied to
                your configuration.
              </p>
            )}
            <p className="opacity-80">
              {inaccessible.length} repo source{inaccessible.length !== 1 ? 's' : ''} could not
              be accessed and {inaccessible.length !== 1 ? 'were' : 'was'} skipped:{' '}
              <span className="font-medium">{inaccessible.map(entryLabel).join(', ')}</span>
            </p>
          </div>
        )}

        {hasPat && status === 'done' && inaccessible.length === 0 && accessible.length > 0 && (
          <p className="text-xs mt-0.5 opacity-80">
            {accessible.length} repo source{accessible.length !== 1 ? 's' : ''} from the shared
            link {accessible.length !== 1 ? 'have' : 'has'} been added to your configuration.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!hasPat && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60"
          >
            <Settings className="h-3.5 w-3.5" />
            Open Settings
          </button>
        )}
        {(status === 'done' || !hasPat) && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
