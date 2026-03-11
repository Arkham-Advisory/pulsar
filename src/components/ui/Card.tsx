import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
}

export function Card({ children, className, hover = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'card p-5',
        hover && 'cursor-pointer hover:border-brand-400 hover:shadow-md transition-all duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="p-1.5 bg-brand-50 dark:bg-brand-950/30 rounded-lg text-brand-600 dark:text-brand-400">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="ml-2">{action}</div>}
    </div>
  );
}
