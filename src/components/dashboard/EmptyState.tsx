import { GitPullRequest, BarChart3, ArrowRight } from 'lucide-react';

interface Props {
  onOpenSettings: () => void;
}

export function EmptyState({ onOpenSettings }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="p-5 bg-brand-50 dark:bg-brand-950/30 rounded-2xl">
              <GitPullRequest className="h-12 w-12 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="absolute -top-1 -right-1 p-1.5 bg-green-500 rounded-full">
              <BarChart3 className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Pulsar
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
          Get instant insights into your team's pull request activity, cycle times,
          review workloads, and bottlenecks — all in one beautiful dashboard.
        </p>

        {/* Steps */}
        <div className="grid gap-3 mb-8">
          {[
            { title: 'Add your GitHub PAT', desc: 'A Personal Access Token with repo scope. Never leaves your browser.' },
            { title: 'Select repositories', desc: 'Choose which orgs & repos to analyze.' },
            { title: 'View your dashboard', desc: 'Metrics, charts, and actionable insights updated automatically.' },
          ].map(({ title, desc }, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-left"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-bold text-sm shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={onOpenSettings} className="btn-primary px-6 py-2.5 text-sm">
          Get Started
          <ArrowRight className="h-4 w-4" />
        </button>

        <p className="mt-4 text-xs text-slate-400">
          Your PAT is stored locally in your browser only. No backend, no data collection.
        </p>
      </div>
    </div>
  );
}
