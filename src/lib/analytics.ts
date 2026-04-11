/**
 * Analytics — PostHog, opt-in via VITE_POSTHOG_KEY.
 *
 * When the env var is absent (local dev, self-hosted builds) this module
 * never imports posthog-js, so it is fully tree-shaken from the bundle.
 */

import type { AuthenticatedGitHubUser } from '../services/github';

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
let pendingGitHubUser: AuthenticatedGitHubUser | null = null;

interface PostHogClient {
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  isFeatureEnabled?: (flag: string) => boolean | undefined;
  onFeatureFlags?: (callback: () => void) => (() => void) | void;
  reloadFeatureFlags?: () => void;
}

function getPostHog(): PostHogClient | undefined {
  return (window as Window & { posthog?: PostHogClient }).posthog;
}

function applyGitHubIdentity(ph: PostHogClient, user: AuthenticatedGitHubUser): void {
  ph.identify(`github:${user.id}`, {
    identity_provider: 'github',
    github_login: user.login,
    github_id: user.id,
    github_profile_url: user.html_url,
    github_avatar_url: user.avatar_url,
  });
}

export function isAnalyticsEnabled(): boolean {
  return !!key;
}

export async function initAnalytics(): Promise<void> {
  if (!key) return;

  const { default: posthog } = await import('posthog-js');
  posthog.init(key, {
    api_host: 'https://z.arkham-advisory.com',
    ui_host: 'https://eu.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,          // no automatic click/input capture
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask-text]',
      blockSelector: '[data-ph-no-capture]',
    },
  });
  window.dispatchEvent(new Event('posthog:ready'));

  if (pendingGitHubUser) {
    applyGitHubIdentity(posthog, pendingGitHubUser);
    pendingGitHubUser = null;
  }
}

export function identifyGitHubUser(user: AuthenticatedGitHubUser): void {
  if (!key) return;

  pendingGitHubUser = user;

  const ph = getPostHog();
  if (!ph?.identify) return;

  applyGitHubIdentity(ph, user);
  ph.reloadFeatureFlags?.();
  pendingGitHubUser = null;
}

export function resetAnalyticsIdentity(): void {
  pendingGitHubUser = null;

  const ph = getPostHog();
  if (!ph?.reset) return;

  ph.reset();
}

/**
 * Fire a PostHog event. No-op when PostHog is not initialised (key absent,
 * or called before init() resolves).
 */
export function capture(event: string, properties?: Record<string, unknown>): void {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture(event, properties);
}

export function isFeatureEnabled(flag: string): boolean {
  const ph = getPostHog();
  return ph?.isFeatureEnabled?.(flag) === true;
}

export function subscribeToFeatureFlag(
  flag: string,
  onChange: (enabled: boolean) => void,
): () => void {
  const ph = getPostHog();
  if (!ph) {
    onChange(false);
    return () => {};
  }

  const emit = () => onChange(ph.isFeatureEnabled?.(flag) === true);
  const unsubscribe = ph.onFeatureFlags?.(emit);
  emit();

  return typeof unsubscribe === 'function' ? unsubscribe : () => {};
}

export function reloadFeatureFlags(): void {
  const ph = getPostHog();
  ph?.reloadFeatureFlags?.();
}
