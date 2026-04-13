import { test, expect } from '@playwright/test';
import { MOCK_MERGED_PR, MOCK_PR, getMockPrTitleLink, mockGitHub, seedSettings } from './fixtures';

const PALETTE_SHORTCUT = process.platform === 'darwin' ? 'Meta+K' : 'Control+K';

test.describe('command palette', () => {
  test('opens from the shortcut', async ({ page }) => {
    await seedSettings(page, { extra: { analyticsConsent: true } });
    await mockGitHub(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: /open command palette/i })).toBeVisible();
    await page.keyboard.press(PALETTE_SHORTCUT);
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search commands, filters, prs/i)).toBeFocused();
  });

  test('navigates to overview from the palette', async ({ page }) => {
    await seedSettings(page, { extra: { analyticsConsent: true } });
    await mockGitHub(page);
    await page.goto('/');

    await page.keyboard.press(PALETTE_SHORTCUT);
    const palette = page.getByRole('dialog', { name: /command palette/i });
    await palette.getByPlaceholder(/search commands, filters, prs/i).fill('overview');
    await palette.getByRole('button', { name: /go to overview/i }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByText(/open prs/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('runs the numbered command shortcut from an empty query', async ({ page }) => {
    await seedSettings(page, { extra: { analyticsConsent: true } });
    await mockGitHub(page);
    await page.goto('/');

    await page.keyboard.press(PALETTE_SHORTCUT);
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();
    await page.keyboard.press('2');
    await expect(page.getByText(/open prs/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('can search PRs, open a PR, toggle merged, clear filters, and copy a share link', async ({ page }) => {
    await seedSettings(page, { extra: { analyticsConsent: true } });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockGitHub(page);
    await page.goto('/');
    await expect(getMockPrTitleLink(page)).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press(PALETTE_SHORTCUT);
    let palette = page.getByRole('dialog', { name: /command palette/i });
    await palette.getByPlaceholder(/search commands, filters, prs/i).fill('heatmap');
    await palette.getByRole('button', { name: new RegExp(MOCK_PR.title, 'i') }).click();
    await expect(page.getByRole('dialog', { name: new RegExp(`pr #${MOCK_PR.number}`, 'i') })).toBeVisible();
    await page.getByRole('button', { name: /close panel/i }).click();

    await page.keyboard.press(PALETTE_SHORTCUT);
    palette = page.getByRole('dialog', { name: /command palette/i });
    await palette.getByPlaceholder(/search commands, filters, prs/i).fill('merged');
    await palette.getByRole('button', { name: /show merged prs/i }).click();
    await expect(page.getByText(MOCK_MERGED_PR.title)).toBeVisible();

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
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('#filter=');
  });
});
