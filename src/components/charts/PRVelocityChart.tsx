import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { WeeklyDataPoint } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { GitPullRequest } from 'lucide-react';

interface Props {
  data: WeeklyDataPoint[];
  loading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{label}</p>
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

export function PRVelocityChart({ data, loading }: Props) {
  return (
    <Card className="col-span-2">
      <CardHeader
        title="PR Velocity"
        subtitle="Opened, merged, and closed PRs per week"
        icon={<GitPullRequest className="h-4 w-4" />}
      />
      {loading ? (
        <div className="h-64 skeleton rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:[&>line]:stroke-slate-700" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />
            <Line
              type="monotone"
              dataKey="opened"
              name="Opened"
              stroke="#6170f8"
              strokeWidth={2}
              dot={{ fill: '#6170f8', r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="merged"
              name="Merged"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ fill: '#22c55e', r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="closed"
              name="Closed (unmerged)"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ fill: '#f97316', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
