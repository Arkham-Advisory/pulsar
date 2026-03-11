import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { CycleTimeDataPoint } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { Clock } from 'lucide-react';
import { formatDuration } from '../../lib/metrics';

interface Props {
  data: CycleTimeDataPoint[];
  loading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as CycleTimeDataPoint;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{label}</p>
      <div className="text-slate-500 dark:text-slate-400">Avg cycle time: <span className="font-medium text-slate-900 dark:text-slate-100">{formatDuration(d.avgHours)}</span></div>
      <div className="text-slate-500 dark:text-slate-400 mt-1">PRs merged: <span className="font-medium text-slate-900 dark:text-slate-100">{d.count}</span></div>
    </div>
  );
};

export function CycleTimeChart({ data, loading }: Props) {
  const maxHours = Math.max(...data.map((d) => d.avgHours), 1);

  return (
    <Card>
      <CardHeader
        title="Avg Cycle Time"
        subtitle="Hours from open to merge, per week"
        icon={<Clock className="h-4 w-4" />}
      />
      {loading ? (
        <div className="h-56 skeleton rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
              tickFormatter={(v) => `${Math.round(v / 24)}d`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="avgHours" radius={[4, 4, 0, 0]} name="Avg cycle time">
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.avgHours > maxHours * 0.75 ? '#f97316' : entry.avgHours > maxHours * 0.4 ? '#f59e0b' : '#6170f8'}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
