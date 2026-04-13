/**
 * Smoke tests — verify the app loads and core UI is present.
 */

import { test, expect } from '@playwright/test';
import { getMockPrTitleLink, seedSettings, mockGitHub } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seedSettings(page);
  await mockGitHub(page);
  await page.goto('/');
});

test('renders the app header with navigation tabs', async ({ page }) => {
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('tab', { name: /pull requests/i }).or(page.getByText(/pull requests/i)).first()).toBeVisible();
});

test('shows PR list content area', async ({ page }) => {
  // The .flex-1 content area should be visible — wait for loading spinner to disappear
  await expect(getMockPrTitleLink(page)).toBeVisible({ timeout: 15_000 });
});

test('navigates to overview page', async ({ page }) => {
  await page.getByRole('link', { name: /overview/i }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByText(/open prs/i).first()).toBeVisible({ timeout: 10_000 });
});

test('navigates to API limits page', async ({ page }) => {
  await page.getByRole('link', { name: /api/i }).click();
  await expect(page.getByText(/rate limit/i).first()).toBeVisible({ timeout: 10_000 });
});
