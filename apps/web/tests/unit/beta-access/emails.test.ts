import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/beta-access/answers', () => ({ describeAnswers: () => [] }));

import { declineEmail, reviewEmail, signLinkEmail } from '@/lib/beta-access/emails';
import { accountInviteEmail } from '@/lib/accounts/invites';
import { confirmationEmail } from '@/lib/feedback/email';

describe('beta emails', () => {
  it('marks every email that carries a single-use link as secret', () => {
    const at = new Date('2026-11-01T00:00:00Z');
    expect(signLinkEmail({ url: 'https://x/t', expiresAt: at, resume: false }).secret).toBe(true);
    expect(accountInviteEmail({ url: 'https://x/t', expiresAt: at }).secret).toBe(true);
    expect(confirmationEmail({ confirmUrl: 'https://x/t', projectSlug: 'aletheia', title: 't', type: 'bug' }).secret).toBe(true);
  });

  it('decline email says what is kept and does not promise deletion', () => {
    const mail = declineEmail({ reapplyAfter: new Date('2027-02-01T00:00:00Z') });
    for (const body of [mail.text, mail.html ?? '']) {
      expect(body).toContain('keep your signed application and our decision for six years');
      expect(body).not.toMatch(/delete/i);
    }
  });

  it('review email links to the admin page for the application', () => {
    const application = { id: 'app-1', answers: {} } as never;
    const document = { id: 'doc-1', docType: 'beta-access', docVersion: 'v', blocks: [], emailConfirmedAt: new Date(), signedAt: new Date(), typedSignature: 'J', pdfSha256: 'h', sealAlg: 'a', sealKeyId: 'k' } as never;
    const mail = reviewEmail({ application, document, siteUrl: 'https://astrealabs.com' });
    expect(mail.text).toContain('https://astrealabs.com/admin/applications/app-1');
    expect(mail.html).toContain('https://astrealabs.com/admin/applications/app-1');
  });
});
