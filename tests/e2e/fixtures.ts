/**
 * Shared fixtures used across Playwright tests.
 *
 * Provides:
 *  - `seedSettings`: injects stubbed Settings into localStorage so the app
 *    considers itself configured (PAT + repo filter) without real GitHub credentials.
 *  - `mockGitHub`: intercepts all api.github.com requests and returns stable
 *    fixture data so tests are fully offline and deterministic.
 */

import type { Locator, Page, Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Minimal mock data
// ---------------------------------------------------------------------------

export const MOCK_PR = {
  id: 1,
  number: 42,
  title: 'feat: add contributor heatmap',
  html_url: 'https://github.com/acme/frontend/pull/42',
  state: 'open',
  merged_at: null,
  closed_at: null,
  created_at: '2026-04-01T10:00:00Z',
  updated_at: '2026-04-10T12:00:00Z',
  user: { login: 'alice', avatar_url: 'https://avatars.githubusercontent.com/u/1', html_url: '' },
  labels: [],
  draft: false,
  requested_reviewers: [],
  assignees: [],
  base: { ref: 'main' },
  head: { ref: 'feat/heatmap', sha: 'abc1234' },
  additions: 120,
  deletions: 30,
  changed_files: 5,
  review_comments: 2,
  comments: 1,
  commits: 3,
};

export const MOCK_MERGED_PR = {
  ...MOCK_PR,
  id: 2,
  number: 41,
  title: 'fix: resolve stale PR edge case',
  state: 'closed',
  merged_at: '2026-04-05T15:00:00Z',
  closed_at: '2026-04-05T15:00:00Z',
  updated_at: '2026-04-05T15:00:00Z',
};

// ---------------------------------------------------------------------------
// Settings seed
// ---------------------------------------------------------------------------

export interface SeedOptions {
  /** Extra settings fields to merge on top of the defaults. */
  extra?: Record<string, unknown>;
}

export async function seedSettings(page: Page, options: SeedOptions = {}) {
  const settings = {
    state: {
      pat: 'ghp_mock_token_for_testing',
      userLogin: 'alice',
      selectedRepos: [],
      repoFilters: [{ id: 'r1', type: 'repo', owner: 'acme', repo: 'frontend' }],
      timeRange: '30d',
      staleDaysThreshold: 7,
      darkMode: true,
      refreshIntervalMinutes: 5,
      sectionOpen: {},
      analyticsConsent: false,
      hideBotPRs: false,
      filterPresets: [],
      pinnedPRs: [],
      ...(options.extra ?? {}),
    },
    version: 0,
  };

  await page.addInitScript((s) => {
    // Only seed if there's no existing state — preserves changes made during the test (e.g. pinning) across page.reload()
    if (!localStorage.getItem('pr-dashboard-settings')) {
      localStorage.setItem('pr-dashboard-settings', JSON.stringify(s));
    }
  }, settings);
}

export async function mockClipboard(page: Page) {
  await page.addInitScript(() => {
    const clipboard = {
      writeText: async (text: string) => {
        (window as Window & { __mockClipboardText?: string }).__mockClipboardText = text;
      },
      readText: async () => (window as Window & { __mockClipboardText?: string }).__mockClipboardText ?? '',
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });
  });
}

// ---------------------------------------------------------------------------
// GitHub API mock
// ---------------------------------------------------------------------------

const emptyPage = { data: [], headers: {} };
const rateLimitResponse = {
  resources: {
    core: { limit: 5000, used: 1, remaining: 4999, reset: 9999999999 },
    search: { limit: 30, used: 0, remaining: 30, reset: 9999999999 },
  },
  rate: { limit: 5000, used: 1, remaining: 4999, reset: 9999999999 },
};

export async function mockGitHub(page: Page) {
  await page.route('**/api.github.com/**', async (route: Route) => {
    const requestUrl = new URL(route.request().url());
    const { pathname, searchParams } = requestUrl;

    // /user — identity check
    if (pathname === '/user') {
      return route.fulfill({ json: { login: 'alice', avatar_url: 'https://avatars.githubusercontent.com/u/1' } });
    }

    // Rate limit
    if (pathname === '/rate_limit') {
      return route.fulfill({ json: rateLimitResponse });
    }

    // PR list
    if (pathname === '/repos/acme/frontend/pulls') {
      return route.fulfill({
        json: searchParams.get('state') === 'closed' ? [MOCK_MERGED_PR] : [MOCK_PR],
      });
    }

    // Single PR (detail panel)
    if (pathname === '/repos/acme/frontend/pulls/42') {
      return route.fulfill({ json: { ...MOCK_PR, body: '## Summary\n\nAdds heatmap.' } });
    }

    // PR commits
    if (pathname === '/repos/acme/frontend/pulls/42/commits') {
      return route.fulfill({
        json: [{
          sha: 'abc1234',
          commit: { author: { date: '2026-04-01T11:00:00Z' }, committer: { date: '2026-04-01T11:00:00Z' }, message: 'initial' },
        }],
      });
    }

    // PR reviews
    if (pathname === '/repos/acme/frontend/pulls/42/reviews') {
      return route.fulfill({
        json: [{
          id: 1,
          user: { login: 'bob', avatar_url: '' },
          state: 'APPROVED',
          submitted_at: '2026-04-03T09:00:00Z',
          body: 'LGTM',
        }],
      });
    }

    // Check runs
    if (pathname === '/repos/acme/frontend/commits/abc1234/check-runs') {
      return route.fulfill({ json: { check_runs: [] } });
    }

    // Any other list → empty
    return route.fulfill({ json: emptyPage.data });
  });
}

export function getMockPrTitleLink(page: Page): Locator {
  return page.getByTitle(MOCK_PR.title).first();
}

export function getMockPrRow(page: Page): Locator {
  return getMockPrTitleLink(page).locator('xpath=ancestor::*[@role="button"][1]');
}
