import { BarChart3, Github, ShieldCheck } from 'lucide-react';
import { useSettingsStore } from '../../store/settings';
import { initAnalytics } from '../../lib/analytics';

const GITHUB_URL = 'https://github.com/stumpyfr/pulsar';

// Only relevant when PostHog is configured (hosted version).
const ANALYTICS_ENABLED = !!import.meta.env.VITE_POSTHOG_KEY;

export function AnalyticsConsent() {
  const { analyticsConsent, setAnalyticsConsent } = useSettingsStore();

  if (!ANALYTICS_ENABLED) return null;
  if (analyticsConsent !== null) return null;

  const handleAccept = async () => {
    setAnalyticsConsent(true);
    await initAnalytics();
  };

  const handleSelfHost = () => {
    setAnalyticsConsent(false);
    window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header stripe */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 bg-brand-50 dark:bg-brand-950/40 rounded-xl">
            <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              A note on analytics
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Pulsar · hosted version
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            This hosted version collects <strong className="text-slate-800 dark:text-slate-200">anonymous usage data</strong> to help improve Pulsar — things like which pages you visit or how you interact with filters.
          </p>

          <ul className="space-y-1.5">
            {[
              'No GitHub tokens or credentials',
              'No repo names, org names, or PR titles',
              'No personal or identifying information',
              'Powered by PostHog',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <BarChart3 className="h-3.5 w-3.5 text-brand-500 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            Prefer no analytics? You can self-host Pulsar for free — all the code is open-source.
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAccept}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white transition-colors"
          >
            Accept &amp; Continue
          </button>
          <button
            type="button"
            onClick={handleSelfHost}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <Github className="h-3.5 w-3.5" />
            Self-host on GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
