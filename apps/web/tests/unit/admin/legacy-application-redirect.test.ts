import { describe, expect, it, vi } from 'vitest';

const permanentRedirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
);
vi.mock('next/navigation', () => ({ permanentRedirect }));

import Page from '@/app/(admin)/admin/licenses/applications/[id]/page';

const ID = '7d3b0e4c-1f2a-4b5c-9d6e-0a1b2c3d4e5f';

describe('legacy application path', () => {
  it('redirects to /admin/applications/[id]', async () => {
    await expect(Page({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve({}) })).rejects.toThrow(
      `REDIRECT:/admin/applications/${ID}`,
    );
  });
  it('keeps the notice', async () => {
    await expect(
      Page({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve({ notice: 'approved' }) }),
    ).rejects.toThrow(`REDIRECT:/admin/applications/${ID}?notice=approved`);
  });
});
