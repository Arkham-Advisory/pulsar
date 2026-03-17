import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '../store/settings';
import type { PullRequest } from '../types/github';

const NOTIFY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per event key

const STORAGE_KEY = 'pr-dashboard-notified-events';

function getNotifiedEvents(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveNotifiedEvents(events: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore storage errors
  }
}

function shouldNotify(key: string, notifiedEvents: Record<string, number>): boolean {
  const last = notifiedEvents[key];
  if (!last) return true;
  return Date.now() - last > NOTIFY_COOLDOWN_MS;
}

function sendNotification(title: string, body: string, url?: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, icon: '/favicon.ico' });
  if (url) {
    n.onclick = () => {
      window.open(url, '_blank');
      n.close();
    };
  }
}

export function useNotifications(): void {
  const { notificationsEnabled, userLogin, staleDaysThreshold } = useSettingsStore();
  const qc = useQueryClient();

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const checkNotifications = () => {
      // Get PR list from any matching query (key starts with 'pr-list')
      const prQueries = qc.getQueriesData<PullRequest[]>({ queryKey: ['pr-list'] });
      const prs: PullRequest[] = prQueries.flatMap(([, data]) => data ?? []);
      if (prs.length === 0) return;

      // Build CI status map from any cached ci-statuses queries
      const ciQueries = qc.getQueriesData<Map<number, PullRequest['ciStatus']>>({ queryKey: ['ci-statuses'] });
      const ciStatusMap = new Map<number, PullRequest['ciStatus']>();
      for (const [, data] of ciQueries) {
        if (data) {
          for (const [id, status] of data) {
            ciStatusMap.set(id, status);
          }
        }
      }

      const notifiedEvents = getNotifiedEvents();
      const now = Date.now();
      const staleCutoffMs = staleDaysThreshold * 24 * 60 * 60 * 1000;

      for (const pr of prs) {
        if (pr.state !== 'open' || pr.draft) continue;

        // Review requested: you are listed as a requested reviewer
        if (userLogin && pr.requested_reviewers.some((r) => r.login === userLogin)) {
          const key = `${pr.repo}#${pr.number}:review_requested`;
          if (shouldNotify(key, notifiedEvents)) {
            sendNotification(
              'Review requested',
              `${pr.repo} #${pr.number}: ${pr.title}`,
              pr.html_url
            );
            notifiedEvents[key] = now;
          }
        }

        // CI failed on your own PR (use enriched CI status if available, else fall back to pr.ciStatus)
        if (userLogin && pr.user.login === userLogin) {
          const ciStatus = ciStatusMap.get(pr.id) ?? pr.ciStatus;
          if (ciStatus === 'failure') {
            const key = `${pr.repo}#${pr.number}:ci_failed`;
            if (shouldNotify(key, notifiedEvents)) {
              sendNotification(
                'CI check failed',
                `${pr.repo} #${pr.number}: ${pr.title}`,
                pr.html_url
              );
              notifiedEvents[key] = now;
            }
          }
        }

        // Stale PR authored by you
        if (userLogin && pr.user.login === userLogin) {
          const msSinceUpdate = now - new Date(pr.updated_at).getTime();
          if (msSinceUpdate > staleCutoffMs) {
            const key = `${pr.repo}#${pr.number}:stale`;
            if (shouldNotify(key, notifiedEvents)) {
              sendNotification(
                'Stale PR',
                `${pr.repo} #${pr.number}: ${pr.title} — no activity for ${staleDaysThreshold}+ days`,
                pr.html_url
              );
              notifiedEvents[key] = now;
            }
          }
        }
      }

      saveNotifiedEvents(notifiedEvents);
    };

    // Check on initial mount
    checkNotifications();

    // Subscribe to query cache updates for pr-list and ci-statuses
    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey[0];
      if ((key === 'pr-list' || key === 'ci-statuses') && event.type === 'updated') {
        checkNotifications();
      }
    });

    return () => unsubscribe();
  }, [notificationsEnabled, userLogin, staleDaysThreshold, qc]);
}
