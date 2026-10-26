import { expect, test } from '@playwright/test';

test.describe('agent-friendly markdown', () => {
  test('.md routes return markdown', async ({ request }) => {
    for (const path of ['/index.md', '/projects.md', '/projects/aletheia.md', '/writing.md', '/research.md', '/about.md']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type'], path).toContain('text/markdown');
      expect(await res.text(), path).toMatch(/^# /);
    }
    const project = await (await request.get('/projects/aletheia.md')).text();
    expect(project).toContain('# Aletheia');
    expect(project).toContain('## Agent setup prompt');
  });

  test('unknown .md pages 404', async ({ request }) => {
    expect((await request.get('/projects/does-not-exist.md')).status()).toBe(404);
  });

  test('Accept: text/markdown negotiates markdown on the page URL', async ({ request }) => {
    const md = await request.get('/projects/aletheia', { headers: { Accept: 'text/markdown' } });
    expect(md.headers()['content-type']).toContain('text/markdown');
    const html = await request.get('/projects/aletheia', { headers: { Accept: 'text/html' } });
    expect(html.headers()['content-type']).toContain('text/html');
  });

  test('llms.txt links markdown pages', async ({ request }) => {
    const txt = await (await request.get('/llms.txt')).text();
    expect(txt).toContain('https://astrealabs.com/projects/aletheia.md');
    const full = await request.get('/llms-full.txt');
    expect(full.status()).toBe(200);
    expect(await full.text()).toContain('# Aletheia');
  });

  test('pages advertise their markdown alternate', async ({ page }) => {
    await page.goto('/projects/aletheia');
    await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
      'href',
      /\/projects\/aletheia\.md$/,
    );
  });

  test('Copy page copies the markdown', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/research');
    await page.getByRole('button', { name: 'Copy page' }).click();
    await expect(page.getByText('Page copied as markdown')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/^# Research/);
  });

  test('project page offers the agent setup prompt', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/projects/eido');
    await page.getByRole('button', { name: 'Copy prompt' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('pnpm install --frozen-lockfile');
  });
});
