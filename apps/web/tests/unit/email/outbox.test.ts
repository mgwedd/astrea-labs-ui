// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/lib/licensing/db/schema';
import { emailOutbox } from '@/lib/email/db/schema';
import { dismissFailed, failedCount, listFailed, recordedMailer, retryFailed, type Sender } from '@/lib/email/outbox';
import { getNavCounts, getOverview } from '@/lib/admin/overview';
import type { Mail } from '@/lib/licensing/email';
import type { Db } from '@/lib/licensing/service';

let db: Db;
const mail: Mail = { to: 'a@example.com', subject: 'Hello', text: 'plain', html: '<p>html</p>' };
const ok: Sender = async () => 're_123';
const down: Sender = async () => {
  throw new Error('Resend: validation_error: domain not verified');
};
const rows = () => db.select().from(emailOutbox);

beforeEach(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  db = d as unknown as Db;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('recordedMailer', () => {
  it('records a sent email without its body', async () => {
    await recordedMailer(ok, () => db).send(mail);
    expect(await rows()).toMatchObject([{ to: 'a@example.com', status: 'sent', resendId: 're_123', textBody: null, htmlBody: null, error: null }]);
  });

  it('queues a failed email with the error and body, logs the message, and still throws', async () => {
    await expect(recordedMailer(down, () => db).send(mail)).rejects.toThrow('domain not verified');
    expect(await rows()).toMatchObject([{ status: 'failed', error: 'Resend: validation_error: domain not verified', textBody: 'plain', htmlBody: '<p>html</p>', attempts: 1 }]);
    expect(console.error).toHaveBeenCalledWith('email send failed', expect.objectContaining({ error: expect.stringContaining('domain not verified') }));
    expect(await failedCount({ db })).toBe(1);
  });

  it('keeps no body for a secret email', async () => {
    await expect(recordedMailer(down, () => db).send({ ...mail, secret: true })).rejects.toThrow();
    expect(await rows()).toMatchObject([{ status: 'failed', textBody: null, htmlBody: null }]);
  });

  it('never hides the send result when the outbox cannot be written', async () => {
    const broken = () => {
      throw new Error('DATABASE_URL must be set');
    };
    await expect(recordedMailer(ok, broken).send(mail)).resolves.toBeUndefined();
    await expect(recordedMailer(down, broken).send(mail)).rejects.toThrow('domain not verified');
  });
});

describe('the failed queue', () => {
  const failOne = async (m: Mail = mail) => {
    await recordedMailer(down, () => db).send(m).catch(() => {});
    return (await listFailed({ db }))[0]!.id;
  };

  it('retries a failed email: sent, body cleared, attempt counted', async () => {
    const id = await failOne();
    const send = vi.fn(ok);
    expect(await retryFailed({ db, send }, id, 'admin@example.com')).toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith({ to: 'a@example.com', subject: 'Hello', text: 'plain', html: '<p>html</p>' });
    expect(await rows()).toMatchObject([{ status: 'sent', resendId: 're_123', textBody: null, htmlBody: null, error: null, attempts: 2, resolvedBy: 'admin@example.com' }]);
    expect(await failedCount({ db })).toBe(0);
  });

  it('keeps a retry that fails again on the queue with the new error', async () => {
    const id = await failOne();
    const again: Sender = async () => {
      throw new Error('Resend: rate_limit_exceeded: slow down');
    };
    expect(await retryFailed({ db, send: again }, id, 'admin@example.com')).toMatchObject({ ok: false, reason: 'failed' });
    expect(await rows()).toMatchObject([{ status: 'failed', error: 'Resend: rate_limit_exceeded: slow down', attempts: 2, textBody: 'plain' }]);
  });

  it('sends a retry once when two admins click at the same time', async () => {
    const id = await failOne();
    const send = vi.fn(ok);
    const results = await Promise.all([retryFailed({ db, send }, id, 'a@admin'), retryFailed({ db, send }, id, 'b@admin')]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('will not retry a secret email or one already resolved', async () => {
    const secret = await failOne({ ...mail, secret: true });
    expect(await retryFailed({ db, send: ok }, secret, 'admin@example.com')).toEqual({ ok: false, reason: 'not_found' });
    expect(await dismissFailed({ db }, secret, 'admin@example.com')).toBe(true);
    expect(await dismissFailed({ db }, secret, 'admin@example.com')).toBe(false);
    expect(await retryFailed({ db, send: ok }, secret, 'admin@example.com')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('dismisses: off the queue, body cleared', async () => {
    const id = await failOne();
    expect(await dismissFailed({ db }, id, 'admin@example.com')).toBe(true);
    expect(await rows()).toMatchObject([{ status: 'dismissed', textBody: null, htmlBody: null, resolvedBy: 'admin@example.com' }]);
  });

  it('shows failed emails in the sidebar badge and at the top of Needs you', async () => {
    await failOne();
    await recordedMailer(ok, () => db).send(mail);
    expect((await getNavCounts({ db })).emails).toBe(1);
    const o = await getOverview({ db });
    expect(o.emailsFailed).toBe(1);
    expect(o.queue[0]).toMatchObject({ kind: 'email', title: 'a@example.com', href: '/admin/emails', flagged: true });
  });
});
