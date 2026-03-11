import type { AuthorStats } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { UserCheck } from 'lucide-react';
import { formatDuration } from '../../lib/metrics';

interface Props {
  data: AuthorStats[];
  loading?: boolean;
}

export function AuthorActivityTable({ data, loading }: Props) {
  return (
    <Card className="col-span-2">
      <CardHeader
        title="Author Activity"
        subtitle="PR contributions per developer"
        icon={<UserCheck className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 skeleton rounded-lg" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
          No author data available
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">#</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Author</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Opened</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Merged</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Reviews given</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Avg cycle</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((author, i) => (
                <tr
                  key={author.login}
                  className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-5 py-2.5 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-5 py-2.5">
                    <a
                      href={`https://github.com/${author.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 group"
                    >
                      <img
                        src={author.avatar_url}
                        alt={author.login}
                        className="w-6 h-6 rounded-full"
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {author.login}
                      </span>
                    </a>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{author.prsOpened}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="font-semibold text-green-600 dark:text-green-400">{author.prsMerged}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{author.reviewsGiven}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {formatDuration(author.avgCycleTimeHours)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
