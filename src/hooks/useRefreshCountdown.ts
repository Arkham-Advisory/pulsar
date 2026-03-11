import { useState, useEffect } from 'react';

/**
 * Returns a formatted countdown string (e.g. "4:32") until the next auto-refresh,
 * based on the last time data was fetched and the configured interval.
 * Returns null when there's no valid baseline or interval is 0.
 */
export function useRefreshCountdown(
  lastUpdated: Date | null,
  intervalMinutes: number,
): string | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!lastUpdated || intervalMinutes <= 0) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const nextAt = lastUpdated.getTime() + intervalMinutes * 60 * 1000;
      const secs = Math.max(0, Math.round((nextAt - Date.now()) / 1000));
      setRemaining(secs);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated, intervalMinutes]);

  if (remaining === null) return null;

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
