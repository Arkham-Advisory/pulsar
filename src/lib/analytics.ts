/**
 * Analytics — PostHog, opt-in via VITE_POSTHOG_KEY.
 *
 * When the env var is absent (local dev, self-hosted builds) this module
 * never imports posthog-js, so it is fully tree-shaken from the bundle.
 */

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

export async function initAnalytics(): Promise<void> {
  if (!key) return;

  const { default: posthog } = await import('posthog-js');
  posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,          // no automatic click/input capture
    disable_session_recording: true,
  });
}

/**
 * Fire a PostHog event. No-op when PostHog is not initialised (key absent,
 * or called before init() resolves).
 */
export function capture(event: string, properties?: Record<string, unknown>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ph = (window as any).posthog;
  if (!ph) return;
  ph.capture(event, properties);
}
