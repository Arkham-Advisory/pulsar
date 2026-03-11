import { useRateLimit } from '../hooks/useRateLimit';
import { useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '../store/settings';
import { Spinner } from '../components/ui/Spinner';
import { cn } from '../lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { RefreshCw, Key, Shield, AlertTriangle } from 'lucide-react';
import type { RateLimitBucket } from '../services/github';

function BucketCard({ label, bucket }: { label: string; bucket: RateLimitBucket }) {
  const pct = bucket.limit > 0 ? (bucket.remaining / bucket.limit) * 100 : 0;
  const usedPct = 100 - pct;
  const color =
    pct > 50 ? 'bg-green-500' :
    pct > 20 ? 'bg-amber-400' :
               'bg-red-500';
  const textColor =
    pct > 50 ? 'text-green-600 dark:text-green-400' :
    pct > 20 ? 'text-amber-600 dark:text-amber-400' :
               'text-red-600 dark:text-red-400';

  const resetsIn = bucket.reset > new Date()
    ? formatDistanceToNow(bucket.reset, { addSuffix: true })
    : 'now';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
        {pct < 20 && (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
            <AlertTriangle className="h-3 w-3" />
            Low
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${usedPct}%` }}
        />
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <span className={cn('text-2xl font-bold tabular-nums', textColor)}>
            {bucket.remaining.toLocaleString()}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">
            / {bucket.limit.toLocaleString()} remaining
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">Resets {resetsIn}</p>
          <p className="text-xs text-slate-400 dark:text-slate-600">{format(bucket.reset, 'HH:mm:ss')}</p>
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        {bucket.used.toLocaleString()} used · {Math.round(pct)}% remaining
      </div>
    </div>
  );
}

export function APILimitsPage() {
  const enabled = !!useSettingsStore().pat;
  const { data, isLoading, isFetching, error, dataUpdatedAt } = useRateLimit(enabled);
  const qc = useQueryClient();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">API Rate Limits</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              GitHub limits API calls per token per time window. Limits reset automatically.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dataUpdatedAt && (
              <span className="text-xs text-slate-400">
                Updated {format(new Date(dataUpdatedAt), 'HH:mm:ss')}
              </span>
            )}
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: ['rate-limit'] })}
              disabled={isFetching}
              className="btn-ghost p-2"
              title="Refresh"
            >
              {isFetching
                ? <Spinner size="sm" className="h-4 w-4" />
                : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-400">Fetching rate limit data…</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to load rate limit data. Check your PAT has the correct scopes.
          </div>
        )}

        {data && (
          <>
            {/* Rate limit buckets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <BucketCard label="Core (REST API)" bucket={data.core} />
              <BucketCard label="Search API" bucket={data.search} />
              <BucketCard label="GraphQL API" bucket={data.graphql} />
              {data.codeSearch && (
                <BucketCard label="Code Search" bucket={data.codeSearch} />
              )}
            </div>

            {/* Token info */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Key className="h-4 w-4 text-slate-400" />
                Token Info
              </h3>

              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Authenticated as</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">@{data.login}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Standard REST limit</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {data.core.limit.toLocaleString()} / hour
                  </p>
                </div>
              </div>

              {data.scopes.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Token scopes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.scopes.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  Scope information not available for fine-grained tokens.
                </p>
              )}
            </div>

            {/* Guidance */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p><strong className="text-slate-700 dark:text-slate-300">Core (REST)</strong> — Used by all /repos, /pulls, /users endpoints. 5,000 req/h for authenticated users.</p>
              <p><strong className="text-slate-700 dark:text-slate-300">Search</strong> — Used when discovering repos by prefix. 30 req/min for authenticated users.</p>
              <p><strong className="text-slate-700 dark:text-slate-300">GraphQL</strong> — 5,000 points/h. Not yet used by this dashboard.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
