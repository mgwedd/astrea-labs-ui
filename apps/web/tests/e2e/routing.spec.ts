import { expect, test } from '@playwright/test';

test.describe('Astrea Labs routing', () => {
  test('home page lists selected work', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Astrea Labs/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('AI research in embedded systems');
    await expect(page.getByRole('heading', { name: 'Selected work' })).toBeVisible();
  });

  test('project pages render', async ({ page }) => {
    await page.goto('/projects/aletheia');
    await expect(page.getByRole('heading', { level: 1, name: 'Aletheia' })).toBeVisible();
  });

  test('domain filter narrows projects', async ({ page }) => {
    await page.goto('/projects?domain=autonomy');
    await expect(page.getByRole('link', { name: 'Astrea SDA' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Aletheia' })).toHaveCount(0);
  });

  test('subdomain query override shows the project landing', async ({ page }) => {
    await page.goto('/?subdomain=sda');
    await expect(page.getByRole('heading', { level: 1, name: 'Astrea SDA' })).toBeVisible();
  });

  test('unknown pages 404', async ({ page }) => {
    const res = await page.goto('/projects/does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('banner')).toBeVisible();
  });
});
