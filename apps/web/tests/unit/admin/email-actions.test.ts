import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.fn();
vi.mock('@/lib/admin/gate', () => ({ requireAdmin: () => requireAdmin() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const mail = vi.hoisted(() => ({ sendBroadcast: vi.fn(), sendTestEmail: vi.fn(), insert: vi.fn() }));
vi.mock('@/lib/email/campaigns', () => ({ sendBroadcast: mail.sendBroadcast, sendTestEmail: mail.sendTestEmail }));
vi.mock('@/lib/licensing/server', () => ({ siteUrlFor: () => 'https://astrealabs.com' }));
vi.mock('@/lib/licensing/db/client', () => ({ getDb: () => ({ insert: () => ({ values: mail.insert }) }) }));

import * as actions from '@/app/(admin)/admin/emails/actions';

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
const valid = form({ subject: 'Hello', body: 'Body', audience: 'news' });

describe('email admin actions', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    for (const fn of Object.values(mail)) fn.mockReset();
  });

  it('covers every exported action', () => {
    expect(Object.keys(actions).sort()).toEqual(['previewCampaign', 'sendCampaign', 'sendTestCampaign']);
  });

  it('every action stops when the admin gate rejects', async () => {
    requireAdmin.mockRejectedValue(new Error('FORBIDDEN'));
    await expect(actions.previewCampaign(null, valid)).rejects.toThrow('FORBIDDEN');
    await expect(actions.sendTestCampaign(valid)).rejects.toThrow('FORBIDDEN');
    await expect(actions.sendCampaign(valid)).rejects.toThrow('FORBIDDEN');
    expect(mail.sendBroadcast).not.toHaveBeenCalled();
    expect(mail.sendTestEmail).not.toHaveBeenCalled();
  });

  it('sends the test only to the signed-in admin', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    mail.sendTestEmail.mockResolvedValue({ ok: true, data: undefined });
    await expect(actions.sendTestCampaign(valid)).rejects.toThrow('notice=test_sent');
    expect(mail.sendTestEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@example.com' }));
    expect(mail.sendBroadcast).not.toHaveBeenCalled();
  });

  it('sends a campaign to the chosen audience only and logs it', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    mail.sendBroadcast.mockResolvedValue({ ok: true, data: { id: 'b1' } });
    await expect(actions.sendCampaign(form({ subject: 'S', body: 'B', audience: 'product:aletheia' }))).rejects.toThrow('notice=campaign_sent');
    expect(mail.sendBroadcast).toHaveBeenCalledWith(expect.objectContaining({ audience: 'product:aletheia', subject: 'S' }));
    expect(mail.insert).toHaveBeenCalledWith(expect.objectContaining({ sentBy: 'admin@example.com', status: 'sent', broadcastId: 'b1' }));
  });

  it('shows an error notice, not a 500, when Resend fails', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    mail.sendBroadcast.mockResolvedValue({ ok: false, error: 'boom' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(actions.sendCampaign(valid)).rejects.toThrow('notice=campaign_failed');
    expect(mail.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', broadcastId: null }));
  });

  it('rejects bad input without sending', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    for (const bad of [{ subject: '', body: 'B', audience: 'news' }, { subject: 'S', body: 'B', audience: 'product:nope' }, { subject: 'x'.repeat(201), body: 'B', audience: 'news' }]) {
      await expect(actions.sendCampaign(form(bad))).rejects.toThrow('notice=invalid');
    }
    expect(mail.sendBroadcast).not.toHaveBeenCalled();
  });
});
