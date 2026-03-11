import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ReviewerStats } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Users, BarChart2, List } from 'lucide-react';
import { formatDuration } from '../../lib/metrics';

interface Props {
  data: ReviewerStats[];
  loading?: boolean;
}

type Tab = 'chart' | 'leaderboard';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">@{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500 dark:text-slate-400">{entry.name}:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ReviewWorkloadChart({ data, loading }: Props) {
  const [tab, setTab] = useState<Tab>('chart');

  const tabBtn = (t: Tab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
        tab === t
          ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <Card>
      <CardHeader
        title="Review Workload"
        subtitle={tab === 'chart' ? 'Pending vs completed per reviewer' : 'Reviewer leaderboard'}
        icon={<Users className="h-4 w-4" />}
        action={
          <div className="flex items-center gap-1">
            {tabBtn('chart', <BarChart2 className="h-3 w-3" />, 'Chart')}
            {tabBtn('leaderboard', <List className="h-3 w-3" />, 'Leaderboard')}
          </div>
        }
      />
      {loading ? (
        <div className="h-56 skeleton rounded-lg" />
      ) : data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
          No reviewer data available
        </div>
      ) : tab === 'chart' ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="login"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="reviewsPending" name="Pending" fill="#f97316" radius={[0, 4, 4, 0]} stackId="a" fillOpacity={0.85} />
            <Bar dataKey="reviewsCompleted" name="Completed" fill="#22c55e" radius={[0, 4, 4, 0]} stackId="a" fillOpacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">#</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Reviewer</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Reviews</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="text-amber-500">Changes req.</span>
                </th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="text-orange-400">Pending</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr
                  key={r.login}
                  className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-5 py-2.5 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-5 py-2.5">
                    <a
                      href={`https://github.com/${r.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 group"
                    >
                      <img src={r.avatar_url} alt={r.login} className="w-6 h-6 rounded-full" />
                      <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {r.login}
                      </span>
                    </a>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="font-semibold text-green-600 dark:text-green-400">{r.reviewsCompleted}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`font-semibold ${r.changesRequested > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {r.changesRequested}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`font-semibold ${r.reviewsPending > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-slate-400'}`}>
                      {r.reviewsPending}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
              No reviewer data available
            </div>
          )}
          <p className="px-5 py-2 text-xs text-slate-400">
            Sorted by most reviews completed · {formatDuration(null)}
          </p>
        </div>
      )}
    </Card>
  );
}
