import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PRSizeCategory } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { FileCode } from 'lucide-react';

interface Props {
  data: PRSizeCategory[];
  loading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as PRSizeCategory;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-300">{d.label}</p>
      <p className="text-slate-500 mt-1">{d.count} PRs ({payload[0].percent !== undefined ? `${(payload[0].percent * 100).toFixed(1)}%` : ''})</p>
    </div>
  );
};

const sizeDescriptions: Record<string, string> = {
  Tiny: '≤ 10 lines',
  Small: '11–100 lines',
  Medium: '101–500 lines',
  Large: '501–1000 lines',
  Huge: '> 1000 lines',
};

export function PRSizeChart({ data, loading }: Props) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader
        title="PR Size Distribution"
        subtitle="Lines changed per PR"
        icon={<FileCode className="h-4 w-4" />}
      />
      {loading ? (
        <div className="h-56 skeleton rounded-lg" />
      ) : total === 0 ? (
        <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
          No data available
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="50%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="count"
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {data.map((entry) => (
              <div key={entry.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{entry.label}</span>
                    <span className="text-slate-400 ml-1">({sizeDescriptions[entry.label]})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.count}</span>
                  <span className="text-slate-400 w-10 text-right">
                    {total > 0 ? `${Math.round((entry.count / total) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
