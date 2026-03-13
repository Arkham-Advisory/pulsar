/**
 * Pinned PRs tests.
 *
 * Validates:
 *  - Pin button is visible on hover / focus
 *  - Clicking pin adds the PR to the "Pinned" section
 *  - Clicking unpin removes it from the "Pinned" section
 *  - Pinned state persists across page reloads (localStorage)
 */

import { test, expect } from '@playwright/test';
import { seedSettings, mockGitHub } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seedSettings(page);
  await mockGitHub(page);
  await page.goto('/');
  // Wait for the PR list to be rendered
  await expect(page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' })).toBeVisible({ timeout: 15_000 });
});

test('pin button is visible on row hover', async ({ page }) => {
  const prRow = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await prRow.hover();
  // The pin button should become visible (it uses opacity-0 → group-hover:opacity-100)
  const pinBtn = prRow.getByTitle(/pin pr/i);
  await expect(pinBtn).toBeVisible();
});

test('pinning a PR creates a Pinned section', async ({ page }) => {
  const prRow = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await prRow.hover();
  const pinBtn = prRow.getByTitle(/pin pr/i);
  await pinBtn.click();
  // A "Pinned" section header should now appear
  await expect(page.getByText('Pinned').first()).toBeVisible();
});

test('unpinning a PR removes the Pinned section when empty', async ({ page }) => {
  // Pin first
  const prRow = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await prRow.hover();
  await prRow.getByTitle(/pin pr/i).click();
  await expect(page.getByText('Pinned').first()).toBeVisible();

  // The pin button title changes to "Unpin PR" when pinned
  // Find the pinned copy in the Pinned section and click its unpin button
  const pinnedSection = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await pinnedSection.hover();
  const unpinBtn = page.getByTitle(/unpin pr/i).first();
  await unpinBtn.click();

  // Pinned section should disappear
  await expect(page.getByText('Pinned')).toHaveCount(0, { timeout: 3_000 });
});

test('pin state persists after page reload', async ({ page }) => {
  // Pin the PR
  const prRow = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await prRow.hover();
  await prRow.getByTitle(/pin pr/i).click();
  await expect(page.getByText('Pinned').first()).toBeVisible();

  // Reload
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' })).toBeVisible({ timeout: 15_000 });

  // Pinned section should still be present
  await expect(page.getByText('Pinned').first()).toBeVisible();
});
