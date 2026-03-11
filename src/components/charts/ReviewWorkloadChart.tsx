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
import { Users } from 'lucide-react';

interface Props {
  data: ReviewerStats[];
  loading?: boolean;
}

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
  return (
    <Card>
      <CardHeader
        title="Review Workload"
        subtitle="Pending vs completed reviews per reviewer"
        icon={<Users className="h-4 w-4" />}
      />
      {loading ? (
        <div className="h-56 skeleton rounded-lg" />
      ) : data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
          No reviewer data available
        </div>
      ) : (
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
      )}
    </Card>
  );
}
