import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.fn();
vi.mock('@/lib/admin/gate', () => ({ requireAdmin: () => requireAdmin() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const mail = vi.hoisted(() => ({ deliver: vi.fn(), sendTestEmail: vi.fn(), sendBatch: vi.fn() }));
vi.mock('@/lib/email/campaigns', () => ({ sendBatch: mail.sendBatch, sendTestEmail: mail.sendTestEmail }));
vi.mock('@/lib/email/sends', () => ({ sendCampaign: mail.deliver }));
vi.mock('@/lib/licensing/server', () => ({ siteUrlFor: () => 'https://astrealabs.com' }));
vi.mock('@/lib/licensing/db/client', () => ({ getDb: () => ({}) }));

import * as actions from '@/app/(admin)/admin/emails/actions';

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
const valid = form({ subject: 'Hello', html: '<p>Body</p>', audience: 'news' });

describe('email admin actions', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    for (const fn of Object.values(mail)) fn.mockReset();
  });

  it('covers every exported action', () => {
    expect(Object.keys(actions).sort()).toEqual(['dismissEmail', 'previewCampaign', 'retryEmail', 'sendCampaign', 'sendTestCampaign']);
  });

  it('every action stops when the admin gate rejects', async () => {
    requireAdmin.mockRejectedValue(new Error('FORBIDDEN'));
    await expect(actions.previewCampaign(null, valid)).rejects.toThrow('FORBIDDEN');
    await expect(actions.sendTestCampaign(valid)).rejects.toThrow('FORBIDDEN');
    await expect(actions.sendCampaign(valid)).rejects.toThrow('FORBIDDEN');
    const row = form({ id: '00000000-0000-4000-8000-000000000000' });
    await expect(actions.retryEmail(row)).rejects.toThrow('FORBIDDEN');
    await expect(actions.dismissEmail(row)).rejects.toThrow('FORBIDDEN');
    expect(mail.deliver).not.toHaveBeenCalled();
    expect(mail.sendTestEmail).not.toHaveBeenCalled();
  });

  it('sends the test only to the signed-in admin', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    mail.sendTestEmail.mockResolvedValue({ ok: true, data: undefined });
    await expect(actions.sendTestCampaign(valid)).rejects.toThrow('notice=test_sent');
    expect(mail.sendTestEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@example.com' }));
    expect(mail.deliver).not.toHaveBeenCalled();
  });

  it('sends a campaign to the chosen audience, through the batch sender, and reports the outcome', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    mail.deliver.mockResolvedValue({ status: 'sent', campaignId: 'c1', recipients: 2, failed: 0 });
    await expect(actions.sendCampaign(form({ subject: 'S', html: '<p>B</p>', audience: 'product:aletheia' }))).rejects.toThrow('notice=campaign_sent');
    const [deps, input] = mail.deliver.mock.calls[0];
    expect(deps).toMatchObject({ siteUrl: 'https://astrealabs.com', sendBatch: mail.sendBatch });
    expect(input).toMatchObject({ audience: 'product:aletheia', subject: 'S', sentBy: 'admin@example.com', bodyHtml: '<p>B</p>' });
  });

  it('maps each outcome to its notice, and a thrown error to a failed notice rather than a 500', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    for (const [status, notice] of [['partial', 'campaign_partial'], ['failed', 'campaign_failed'], ['no_recipients', 'campaign_empty']] as const) {
      mail.deliver.mockResolvedValueOnce({ status, campaignId: 'c', recipients: 1, failed: 1 });
      await expect(actions.sendCampaign(valid)).rejects.toThrow(`notice=${notice}`);
    }
    mail.deliver.mockRejectedValueOnce(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(actions.sendCampaign(valid)).rejects.toThrow('notice=campaign_failed');
  });

  it('previews sanitized HTML with the unsubscribe footer appended, and sends the sanitized body', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    const dirty = '<p onclick="x()">Hi</p><script>alert(1)</script>';
    const state = await actions.previewCampaign(null, form({ html: dirty }));
    expect(state).toEqual({ html: expect.stringContaining('<p>Hi</p>') });
    expect(JSON.stringify(state)).toContain('unsubscribe?t=preview');
    expect(JSON.stringify(state)).not.toMatch(/script|onclick/);

    mail.deliver.mockResolvedValue({ status: 'sent', campaignId: 'c1', recipients: 1, failed: 0 });
    await expect(actions.sendCampaign(form({ subject: 'S', html: dirty, audience: 'news' }))).rejects.toThrow('notice=campaign_sent');
    const input = mail.deliver.mock.calls[0][1];
    expect(input.html).toContain('%%UNSUBSCRIBE_TOKEN%%');
    expect(input.html).not.toMatch(/script|onclick/);
    expect(input.bodyHtml).toBe('<p>Hi</p>');
  });

  it('rejects HTML that is empty once sanitized', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    await expect(actions.sendCampaign(form({ subject: 'S', html: '<script>alert(1)</script>', audience: 'news' }))).rejects.toThrow('notice=invalid');
    expect(mail.deliver).not.toHaveBeenCalled();
  });

  it('rejects bad input without sending', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    for (const bad of [{ subject: '', html: '<p>B</p>', audience: 'news' }, { subject: 'S', html: '<p>B</p>', audience: 'product:nope' }, { subject: 'x'.repeat(201), html: '<p>B</p>', audience: 'news' }]) {
      await expect(actions.sendCampaign(form(bad))).rejects.toThrow('notice=invalid');
    }
    expect(mail.deliver).not.toHaveBeenCalled();
  });
});
