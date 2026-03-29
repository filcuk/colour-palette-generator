import { test, expect } from '@playwright/test';

test.describe('Colour Palette Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Colour Palette/i);
  });

  test('loads and shows the main heading', async ({ page }) => {
    await expect(page).toHaveTitle(/Colour Palette/i);
  });

  test('theme name field is visible', async ({ page }) => {
    await expect(page.getByPlaceholder(/My theme or pick saved/i)).toBeVisible();
  });

  test.describe('Themes', () => {
    test('switch theme via combo after creating a second theme', async ({ page }) => {
      await expect(page.locator('#themeName')).toHaveValue(/Theme \d+/);
      const firstName = await page.locator('#themeName').inputValue();

      await page.getByRole('button', { name: 'New', exact: true }).click();
      await expect(page.locator('#themeName')).not.toHaveValue(firstName);

      await page.locator('#themeComboTrigger').click();
      await expect(page.locator('#themeComboList')).toHaveAttribute('aria-hidden', 'false');
      await page.getByRole('option', { name: firstName }).click();
      await expect(page.locator('#themeName')).toHaveValue(firstName);
    });
  });

  test.describe('Theme colours', () => {
    test('count slider changes number of swatches', async ({ page }) => {
      await page.locator('#countSlider').fill('5');
      await expect(page.locator('#countValue')).toHaveText('5');
      await expect(page.getByRole('textbox', { name: /Theme color/ })).toHaveCount(5);
    });

    test('theme swatch accepts hex input and normalizes on Enter', async ({ page }) => {
      const swatch = page.getByRole('textbox', { name: 'Theme color 1' });
      await swatch.click();
      await swatch.fill('f00');
      await swatch.press('Enter');
      await expect(swatch).toHaveValue('#FF0000');
    });

    test('picker HEX applies to active theme swatch', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Theme color 3' }).click();
      const hex = page.locator('#pickerHex');
      await hex.fill('#ABCDEF');
      await hex.press('Enter');
      await expect(page.getByRole('textbox', { name: 'Theme color 3' })).toHaveValue('#ABCDEF');
    });

    test('picker RGB inputs update active swatch', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Theme color 2' }).click();
      await page.locator('#pickerR').fill('10');
      await page.locator('#pickerG').fill('20');
      await page.locator('#pickerB').fill('30');
      await page.locator('#pickerB').press('Enter');
      const val = await page.getByRole('textbox', { name: 'Theme color 2' }).inputValue();
      expect(val).toMatch(/^#[0-9A-F]{6}$/i);
      expect(val.toUpperCase()).toBe('#0A141E');
    });

    test('colour set: switch to Fluent and apply a preset chip', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Theme color 1' }).click();
      await page.locator('#pickerSetSelect').selectOption('fluent2');
      const chip = page.locator('.picker-subsection[data-set="fluent2"] .chip').first();
      await expect(chip).toBeVisible();
      const hex = await chip.getAttribute('data-hex');
      expect(hex).toMatch(/^#[0-9A-F]{6}$/i);
      await chip.click();
      await expect(page.getByRole('textbox', { name: 'Theme color 1' })).toHaveValue(hex ?? '');
    });

    test('picker shade strip applies when shade has a hex', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Theme color 4' }).click();
      const center = page.locator('#pickerShade2');
      await expect(center).toHaveAttribute('data-hex', /^#[0-9A-F]{6}$/i);
      const before = await page.getByRole('textbox', { name: 'Theme color 4' }).inputValue();
      const darker = page.locator('#pickerShade3');
      await darker.click();
      const after = await page.getByRole('textbox', { name: 'Theme color 4' }).inputValue();
      expect(after).not.toBe(before);
      expect(after).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  test.describe('Sentiment & divergent', () => {
    test('enabling sentiment shows three labelled swatches', async ({ page }) => {
      const wrap = page.locator('#rowSentimentWrap');
      await expect(wrap).toHaveClass(/optional-hidden/);
      const heading = page.locator('#blockSentiment .colour-block-heading');
      await heading.scrollIntoViewIfNeeded();
      await heading.click();
      await expect(wrap).not.toHaveClass(/optional-hidden/);
      await expect(page.getByRole('textbox', { name: 'Negative' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Neutral' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Positive' })).toBeVisible();
    });

    test('sentiment swatch accepts hex via picker', async ({ page }) => {
      const sHead = page.locator('#blockSentiment .colour-block-heading');
      await sHead.scrollIntoViewIfNeeded();
      await sHead.click();
      await page.getByRole('textbox', { name: 'Neutral' }).click();
      const hex = page.locator('#pickerHex');
      await hex.fill('#123456');
      await hex.press('Enter');
      await expect(page.getByRole('textbox', { name: 'Neutral' })).toHaveValue('#123456');
    });

    test('enabling divergent shows Low / Mid / High swatches', async ({ page }) => {
      const wrap = page.locator('#rowDivergentWrap');
      await expect(wrap).toHaveClass(/optional-hidden/);
      const dHead = page.locator('#blockDivergent .colour-block-heading');
      await dHead.scrollIntoViewIfNeeded();
      await dHead.click();
      await expect(wrap).not.toHaveClass(/optional-hidden/);
      // exact: true — "Low" can match CMYK Yellow field via accessible name substring
      await expect(page.getByRole('textbox', { name: 'Low', exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Mid', exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'High', exact: true })).toBeVisible();
    });

    test('divergent swatch hex input normalizes', async ({ page }) => {
      const dHead = page.locator('#blockDivergent .colour-block-heading');
      await dHead.scrollIntoViewIfNeeded();
      await dHead.click();
      const mid = page.getByRole('textbox', { name: 'Mid', exact: true });
      await mid.click();
      await mid.fill('00f');
      await mid.press('Enter');
      await expect(mid).toHaveValue('#0000FF');
    });
  });
});
