import { test, expect } from '@playwright/test';

test.describe('Colour Palette Generator', () => {
  test('loads and shows the main heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Colour Palette/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Colour Palette/i);
  });

  test('theme name field is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder(/My theme or pick saved/i)).toBeVisible();
  });
});
