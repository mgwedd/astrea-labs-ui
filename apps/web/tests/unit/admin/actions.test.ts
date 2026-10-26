import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every admin server action must check the admin gate before touching a service.
// The layout gate does not cover actions, which can be POSTed directly.

const requireAdmin = vi.fn();
vi.mock('@/lib/admin/gate', () => ({ requireAdmin: () => requireAdmin() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const services = vi.hoisted(() => ({
  approve: vi.fn(),
  decline: vi.fn(),
  resendKeyLink: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  reissueLicense: vi.fn(),
  revokeLicense: vi.fn(),
  createTestLicense: vi.fn(),
  revealTestLicense: vi.fn(),
  revokeTestLicense: vi.fn(),
}));
vi.mock('@/lib/beta-access/service', () => ({
  approve: services.approve,
  decline: services.decline,
  resendKeyLink: services.resendKeyLink,
}));
vi.mock('@/lib/feedback/service', () => ({
  approveSubmission: services.approveSubmission,
  rejectSubmission: services.rejectSubmission,
}));
vi.mock('@/lib/licensing/service', () => ({
  reissueLicense: services.reissueLicense,
  revokeLicense: services.revokeLicense,
}));
vi.mock('@/lib/licensing/test-license', () => ({
  TEST_LICENSE_DAYS: [1, 3, 7, 30],
  createTestLicense: services.createTestLicense,
  revealTestLicense: services.revealTestLicense,
  revokeTestLicense: services.revokeTestLicense,
}));
vi.mock('@/lib/licensing/keys', () => ({ getSigningKey: () => ({}) }));
vi.mock('@/lib/beta-access/server', () => ({ betaDeps: () => ({}) }));
vi.mock('@/lib/feedback/server', () => ({ feedbackDbDeps: () => ({}) }));
vi.mock('@/lib/licensing/server', () => ({ licensingDeps: () => ({}) }));
// getDb().select().from().where().limit() resolves to licenseRows.
const licenseRows = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('@/lib/licensing/db/client', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => licenseRows.value }) }) }),
  }),
}));

import * as actions from '@/app/(admin)/admin/actions';

const ID = '7d3b0e4c-1f2a-4b5c-9d6e-0a1b2c3d4e5f';

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

// A valid form for each action, so a missing gate would reach the service.
const valid: Record<keyof typeof actions, FormData> = {
  approveApplication: form({ applicationId: ID, source: 'board', result: 'Active', checkedOn: '2026-01-02' }),
  declineApplication: form({ applicationId: ID }),
  revokeLicenseAction: form({ lid: ID, email: 'a@example.com', reason: 'test' }),
  reissueLicenseAction: form({ lid: ID, email: 'a@example.com' }),
  sendKeyLinkAction: form({ lid: ID, email: 'a@example.com' }),
  approveFeedbackAction: form({ id: ID, title: 'T', body: 'B', labels: 'bug' }),
  rejectFeedbackAction: form({ id: ID }),
  createTestLicenseAction: form({ label: 'smoke', days: '7' }),
  revealTestLicenseAction: form({ lid: `test-${ID}` }),
  revokeTestLicenseAction: form({ lid: `test-${ID}` }),
};

describe('admin actions', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    for (const fn of Object.values(services)) fn.mockReset();
    licenseRows.value = [];
  });

  it('covers every exported action', () => {
    expect(Object.keys(actions).sort()).toEqual(Object.keys(valid).sort());
  });

  for (const name of Object.keys(valid) as (keyof typeof actions)[]) {
    it(`${name} stops when the admin gate rejects`, async () => {
      requireAdmin.mockRejectedValue(new Error('FORBIDDEN'));
      await expect(actions[name](valid[name])).rejects.toThrow('FORBIDDEN');
      for (const fn of Object.values(services)) expect(fn).not.toHaveBeenCalled();
    });
  }

  it('records the signed-in admin as reviewer and redirects with a notice', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    services.approve.mockResolvedValue({ ok: true, emailed: true });
    await expect(actions.approveApplication(valid.approveApplication)).rejects.toThrow(
      `REDIRECT:/admin/applications/${ID}?notice=approved`,
    );
    expect(services.approve).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        applicationId: ID,
        reviewer: 'admin@example.com',
        licenseCheck: { source: 'board', result: 'Active', checkedAt: '2026-01-02T00:00:00.000Z' },
      }),
    );
  });

  it('rejects a license check dated in the future', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    const f = form({ applicationId: ID, source: 'board', result: 'Active', checkedOn: '2999-01-01' });
    await expect(actions.approveApplication(f)).rejects.toThrow('notice=invalid');
    expect(services.approve).not.toHaveBeenCalled();
  });

  it('rejects a partial license check on decline', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    const f = form({ applicationId: ID, source: 'board', result: 'Not found' });
    await expect(actions.declineApplication(f)).rejects.toThrow('notice=invalid');
    expect(services.decline).not.toHaveBeenCalled();
  });

  it('reports a failed reissue instead of throwing', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    licenseRows.value = [{ lid: ID, revokedAt: null, replacedBy: null, expiresAt: null }];
    services.reissueLicense.mockRejectedValue(new Error('email down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(actions.reissueLicenseAction(valid.reissueLicenseAction)).rejects.toThrow('notice=reissue_failed');
  });

  it('refuses to reissue a license that is no longer active', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    licenseRows.value = [{ lid: ID, revokedAt: new Date(), replacedBy: null, expiresAt: null }];
    await expect(actions.reissueLicenseAction(valid.reissueLicenseAction)).rejects.toThrow('notice=inactive');
    expect(services.reissueLicense).not.toHaveBeenCalled();
  });

  it('issues a test license only for an offered length', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    await expect(actions.createTestLicenseAction(form({ label: 'x', days: '365' }))).rejects.toThrow('notice=invalid');
    expect(services.createTestLicense).not.toHaveBeenCalled();
    services.createTestLicense.mockResolvedValue({ ok: false, error: 'limit' });
    await expect(actions.createTestLicenseAction(valid.createTestLicenseAction)).rejects.toThrow('notice=test_limit');
    expect(services.createTestLicense).toHaveBeenCalledWith(expect.anything(), { days: 7, label: 'smoke', by: 'admin@example.com' });
  });

  it('reveals a test key to the page, never in a redirect', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    services.revealTestLicense.mockResolvedValue('ALET1.x.y');
    expect(await actions.revealTestLicenseAction(valid.revealTestLicenseAction)).toEqual({ token: 'ALET1.x.y' });
    expect(await actions.revealTestLicenseAction(form({ lid: ID }))).toBeNull();
  });
});
