import React from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  alert?: boolean;
  onClick?: () => void;
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  subValue,
  icon,
  iconColor = 'text-brand-600 dark:text-brand-400',
  trend,
  trendLabel,
  alert = false,
  onClick,
  loading = false,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'card p-5 flex flex-col gap-3',
        alert && 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20',
        onClick && 'cursor-pointer hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all duration-200'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={cn('p-2 rounded-lg bg-slate-50 dark:bg-slate-800', iconColor)}>
          {icon}
        </div>
      </div>

      {loading ? (
        <div className="h-8 w-24 skeleton rounded-lg" />
      ) : (
        <div>
          <div className={cn(
            'text-3xl font-bold tracking-tight',
            alert ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
          )}>
            {value}
          </div>
          {subValue && (
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subValue}</div>
          )}
        </div>
      )}

      {trend && trendLabel && (
        <div className="flex items-center gap-1.5 text-xs">
          {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
          {trend === 'neutral' && <Minus className="h-3 w-3 text-slate-400" />}
          <span className={cn(
            trend === 'up' ? 'text-green-600 dark:text-green-400' :
            trend === 'down' ? 'text-red-600 dark:text-red-400' :
            'text-slate-400'
          )}>
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}
