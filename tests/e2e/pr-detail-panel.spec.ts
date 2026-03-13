/**
 * PR Detail Panel tests.
 *
 * Validates:
 *  - Clicking a PR row opens the detail panel
 *  - The panel displays the PR title and metadata
 *  - The Lifecycle Timeline is rendered once details load
 *  - Pressing Escape closes the panel
 */

import { test, expect } from '@playwright/test';
import { seedSettings, mockGitHub } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seedSettings(page);
  await mockGitHub(page);
  await page.goto('/');
  await expect(page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first()).toBeVisible({ timeout: 15_000 });
});

test('clicking a PR row opens the detail panel', async ({ page }) => {
  const prRow = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await prRow.click();
  // Side panel should appear with the PR number in the header (renders as "frontend#42")
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/frontend#42/)).toBeVisible();
});

test('detail panel shows PR title', async ({ page }) => {
  const prRow = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await prRow.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('feat: add contributor heatmap')).toBeVisible();
});

test('detail panel renders Lifecycle section after loading', async ({ page }) => {
  const prRow = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await prRow.click();
  // Wait for the lifecycle heading (rendered only when details are loaded)
  await expect(page.getByText('Lifecycle')).toBeVisible({ timeout: 10_000 });
});

test('pressing Escape closes the detail panel', async ({ page }) => {
  const prRow = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await prRow.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
});

test('close button in panel header dismisses the panel', async ({ page }) => {
  const prRow = page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first();
  await prRow.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /close panel/i }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
});
