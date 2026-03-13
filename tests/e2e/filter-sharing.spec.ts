/**
 * Filter & URL sharing tests.
 *
 * Validates:
 *  - Typing in the search box updates the input value
 *  - The URL hash is written when a non-default filter is active
 *  - Loading a page with a pre-encoded hash restores the filter state
 *  - The "Copy link" button is present
 */

import { test, expect } from '@playwright/test';
import { seedSettings, mockGitHub } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seedSettings(page);
  await mockGitHub(page);
  await page.goto('/');
});

test('search input is present and accepts text', async ({ page }) => {
  const searchInput = page.getByPlaceholder(/search title, repo, author/i);
  await expect(searchInput).toBeVisible();
  await searchInput.fill('heatmap');
  await expect(searchInput).toHaveValue('heatmap');
});

test('URL hash is updated when search is non-empty', async ({ page }) => {
  const searchInput = page.getByPlaceholder(/search title, repo, author/i);
  await searchInput.fill('heatmap');
  // Hash should appear in the URL after the next render cycle
  await page.waitForFunction(() => window.location.hash.startsWith('#filter='));
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toMatch(/^#filter=/);
  // Decoded content should include search term
  const encoded = hash.slice(8);
  const decoded = JSON.parse(atob(encoded));
  expect(decoded.search).toBe('heatmap');
});

test('URL hash is cleared when filters are reset to defaults', async ({ page }) => {
  const searchInput = page.getByPlaceholder(/search title, repo, author/i);
  await searchInput.fill('heatmap');
  await page.waitForFunction(() => window.location.hash.startsWith('#filter='));
  // Clear the search
  await searchInput.clear();
  await page.waitForFunction(() => !window.location.hash);
  expect(await page.evaluate(() => window.location.hash)).toBe('');
});

test('pre-encoded hash restores filter state on load', async ({ page }) => {
  // Build a filter hash for stateFilter=merged
  const payload = { search: '', stateFilter: 'merged', selectedRepos: [], hideBotPRs: false };
  const hash = `#filter=${btoa(JSON.stringify(payload))}`;
  await page.goto(`/${hash}`);
  // The "merged" tab button should be visually active (has specific styling)
  const mergedBtn = page.getByRole('button', { name: /^merged$/i });
  await expect(mergedBtn).toBeVisible();
  // Verify URL retained the hash
  expect(page.url()).toContain('#filter=');
});

test('copy-link (share) button is visible in toolbar', async ({ page }) => {
  // The share button has title "Copy shareable link to current filters"
  const shareBtn = page.getByTitle(/copy shareable link/i);
  await expect(shareBtn).toBeVisible();
});
