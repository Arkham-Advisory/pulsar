import { test, expect } from '@playwright/test';
import { mockGitHub, mockPostHog, seedSettings } from './fixtures';

const PALETTE_SHORTCUT = process.platform === 'darwin' ? 'Meta+K' : 'Control+K';

test.describe('command palette', () => {
  test('stays hidden when the feature flag is disabled', async ({ page }) => {
    await seedSettings(page, { extra: { analyticsConsent: true } });
    await mockPostHog(page, { commandPalette: false });
    await mockGitHub(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: /open command palette/i })).toHaveCount(0);
    await page.keyboard.press(PALETTE_SHORTCUT);
    await expect(page.getByRole('dialog', { name: /command palette/i })).toHaveCount(0);
  });

  test('opens from the shortcut when the feature flag is enabled', async ({ page }) => {
    await seedSettings(page, { extra: { analyticsConsent: true } });
    await mockPostHog(page, { commandPalette: true });
    await mockGitHub(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: /open command palette/i })).toBeVisible();
    await page.keyboard.press(PALETTE_SHORTCUT);
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search commands, filters, prs/i)).toBeFocused();
  });

  test('navigates to dashboard from the palette', async ({ page }) => {
    await seedSettings(page, { extra: { analyticsConsent: true } });
    await mockPostHog(page, { commandPalette: true });
    await mockGitHub(page);
    await page.goto('/');

    await page.keyboard.press(PALETTE_SHORTCUT);
    const palette = page.getByRole('dialog', { name: /command palette/i });
    await palette.getByPlaceholder(/search commands, filters, prs/i).fill('dashboard');
    await palette.getByRole('button', { name: /go to dashboard/i }).click();
    await expect(page.getByText(/open prs/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('can search PRs, open a PR, toggle merged, clear filters, and copy a share link', async ({ page }) => {
    await seedSettings(page, { extra: { analyticsConsent: true } });
    await mockPostHog(page, { commandPalette: true });
    await mockGitHub(page);
    await page.goto('/');
    await expect(page.locator('[role="button"]').filter({ hasText: 'feat: add contributor heatmap' }).first()).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press(PALETTE_SHORTCUT);
    let palette = page.getByRole('dialog', { name: /command palette/i });
    await palette.getByPlaceholder(/search commands, filters, prs/i).fill('heatmap');
    await palette.getByRole('button', { name: /search prs/i }).click();
    await expect(page.locator('input[placeholder*="Search title"]').first()).toHaveValue('heatmap');

    await page.keyboard.press(PALETTE_SHORTCUT);
    palette = page.getByRole('dialog', { name: /command palette/i });
    await palette.getByPlaceholder(/search commands, filters, prs/i).fill('#42');
    await palette.getByRole('button', { name: /feat: add contributor heatmap/i }).click();
    await expect(page.getByRole('dialog', { name: /pr #42/i })).toBeVisible();
    await page.getByRole('button', { name: /close panel/i }).click();

    await page.keyboard.press(PALETTE_SHORTCUT);
    palette = page.getByRole('dialog', { name: /command palette/i });
    await palette.getByPlaceholder(/search commands, filters, prs/i).fill('merged');
    await palette.getByRole('button', { name: /show merged prs/i }).click();
    await expect(page.getByText(/recently merged/i)).toBeVisible();

    await page.keyboard.press(PALETTE_SHORTCUT);
    palette = page.getByRole('dialog', { name: /command palette/i });
    await palette.getByPlaceholder(/search commands, filters, prs/i).fill('clear');
    await palette.getByRole('button', { name: /clear all filters/i }).click();
    await expect(page.getByText(/my prs/i)).toBeVisible();
    await expect(page.locator('input[placeholder*="Search title"]').first()).toHaveValue('');

    await page.keyboard.press(PALETTE_SHORTCUT);
    palette = page.getByRole('dialog', { name: /command palette/i });
    await palette.getByPlaceholder(/search commands, filters, prs/i).fill('share');
    await palette.getByRole('button', { name: /copy share link/i }).click();
    await expect(page.getByText(/link copied!/i)).toBeVisible();
  });
});
