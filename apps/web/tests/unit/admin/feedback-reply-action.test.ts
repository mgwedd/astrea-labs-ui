import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.fn();
vi.mock('@/lib/admin/gate', () => ({ requireAdmin: () => requireAdmin() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
const replies = vi.hoisted(() => ({ replyToReporter: vi.fn() }));
vi.mock('@/lib/feedback/replies', () => ({ replyToReporter: replies.replyToReporter, MAX_REPLY_LENGTH: 5000 }));
vi.mock('@/lib/feedback/server', () => ({ feedbackDbDeps: () => ({ db: {} }) }));
vi.mock('@/lib/licensing/mailer', () => ({ resendMailer: () => ({ send: vi.fn() }) }));
vi.mock('@/lib/licensing/server', () => ({ siteUrlFor: () => 'https://astrealabs.com' }));

import { replyToReporterAction } from '@/app/(admin)/admin/feedback/actions';

const ID = '2c1d6c0e-6d5e-4a7c-9a51-0f6f1c1e0a11';
const form = (f: Record<string, string>) => {
  const d = new FormData();
  for (const [k, v] of Object.entries(f)) d.set(k, v);
  return d;
};

describe('replyToReporterAction', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    replies.replyToReporter.mockReset();
  });

  it('stops when the admin gate rejects', async () => {
    requireAdmin.mockRejectedValue(new Error('FORBIDDEN'));
    await expect(replyToReporterAction(form({ id: ID, message: 'hi' }))).rejects.toThrow('FORBIDDEN');
    expect(replies.replyToReporter).not.toHaveBeenCalled();
  });

  it('validates the id and message before sending anything', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    await expect(replyToReporterAction(form({ id: ID, message: '   ' }))).rejects.toThrow(`/admin/feedback/${ID}?reply=invalid`);
    await expect(replyToReporterAction(form({ id: ID, message: 'x'.repeat(5001) }))).rejects.toThrow('reply=invalid');
    await expect(replyToReporterAction(form({ id: 'nope', message: 'hi' }))).rejects.toThrow('REDIRECT:/admin/feedback');
    expect(replies.replyToReporter).not.toHaveBeenCalled();
  });

  it('sends as the signed-in admin and redirects with the outcome', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    replies.replyToReporter.mockResolvedValue('sent');
    await expect(replyToReporterAction(form({ id: ID, message: ' Thanks ' }))).rejects.toThrow(`/admin/feedback/${ID}?reply=sent`);
    expect(replies.replyToReporter).toHaveBeenCalledWith(expect.anything(), { submissionId: ID, body: 'Thanks', sentBy: 'admin@example.com' });
  });

  it('reports a failed send instead of throwing', async () => {
    requireAdmin.mockResolvedValue({ email: 'admin@example.com' });
    replies.replyToReporter.mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(replyToReporterAction(form({ id: ID, message: 'hi' }))).rejects.toThrow('reply=send_failed');
  });
});
