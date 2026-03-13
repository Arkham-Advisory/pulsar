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
import type { BottleneckPhaseData } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { formatDuration } from '../../lib/metrics';
import { TrendingDown } from 'lucide-react';

interface Props {
  data: BottleneckPhaseData[];
  loading?: boolean;
}

const PHASE_COLORS = ['#6170f8', '#f59e0b', '#10b981'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as BottleneckPhaseData;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{label}</p>
      <div className="text-slate-500 dark:text-slate-400">
        Avg wait: <span className="font-medium text-slate-900 dark:text-slate-100">{formatDuration(d.avgHours)}</span>
      </div>
      <div className="text-slate-500 dark:text-slate-400 mt-1">
        PRs: <span className="font-medium text-slate-900 dark:text-slate-100">{d.count}</span>
      </div>
    </div>
  );
};

export function BottleneckFunnelChart({ data, loading }: Props) {
  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader
        title="Bottleneck Funnel"
        subtitle="Avg time lost per phase (merged PRs)"
        icon={<TrendingDown className="h-4 w-4" />}
      />
      {loading ? (
        <div className="h-56 skeleton rounded-lg" />
      ) : !hasData ? (
        <div className="h-56 flex items-center justify-center text-sm text-slate-400">
          Not enough merged PR data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" className="dark:[&>line]:stroke-slate-700" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatDuration(v)}
            />
            <YAxis
              type="category"
              dataKey="phase"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="avgHours" radius={[0, 4, 4, 0]} name="Avg hours">
              {data.map((_, index) => (
                <Cell key={index} fill={PHASE_COLORS[index % PHASE_COLORS.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
