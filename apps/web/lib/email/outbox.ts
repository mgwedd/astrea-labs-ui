import 'server-only';
import { and, count, desc, eq } from 'drizzle-orm';
import type { Mail, Mailer } from '@/lib/licensing/email';
import type { Db } from '@/lib/licensing/service';
import { emailOutbox, type EmailOutboxRow } from './db/schema';

// The record of every transactional email. A send that fails is logged with Resend's
// message and queued here, so an admin can retry or dismiss it from /admin/emails.

/** Sends one email and returns the provider's id. Throws when it is not sent. */
export type Sender = (mail: Mail) => Promise<string | undefined>;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 1000);

/**
 * A Mailer that records each send. It throws exactly as `send` would, so callers keep
 * their own handling. A failure to record is logged and never hides the send's result.
 */
export function recordedMailer(send: Sender, getDb: () => Db, now: () => Date = () => new Date()): Mailer {
  return {
    async send(mail) {
      let resendId: string | undefined;
      try {
        resendId = await send(mail);
      } catch (err) {
        console.error('email send failed', { subject: mail.subject, error: message(err) });
        await record(getDb, {
          to: mail.to,
          subject: mail.subject,
          status: 'failed',
          error: message(err),
          textBody: mail.secret ? null : mail.text,
          htmlBody: mail.secret ? null : mail.html,
          lastAttemptAt: now(),
        });
        throw err;
      }
      await record(getDb, { to: mail.to, subject: mail.subject, status: 'sent', resendId, lastAttemptAt: now() });
    },
  };
}

async function record(getDb: () => Db, row: typeof emailOutbox.$inferInsert) {
  try {
    await getDb().insert(emailOutbox).values(row);
  } catch (e) {
    console.error('email outbox write failed', { subject: row.subject, status: row.status, error: message(e) });
  }
}

type Deps = { db: Db };

export async function failedCount({ db }: Deps): Promise<number> {
  const [r] = await db.select({ n: count() }).from(emailOutbox).where(eq(emailOutbox.status, 'failed'));
  return r?.n ?? 0;
}

export async function listFailed({ db }: Deps, limit = 50): Promise<EmailOutboxRow[]> {
  return db.select().from(emailOutbox).where(eq(emailOutbox.status, 'failed')).orderBy(desc(emailOutbox.lastAttemptAt)).limit(limit);
}

export async function listRecent({ db }: Deps, limit = 20): Promise<EmailOutboxRow[]> {
  return db.select().from(emailOutbox).orderBy(desc(emailOutbox.lastAttemptAt)).limit(limit);
}

export type RetryResult = { ok: true } | { ok: false; reason: 'not_found' } | { ok: false; reason: 'failed'; error: string };

/** Sends a failed email again. Secret emails (no stored body) cannot be retried. On success the row is marked sent and its body cleared. */
export async function retryFailed(deps: Deps & { send: Sender; now?: () => Date }, id: string, admin: string): Promise<RetryResult> {
  const { db, send } = deps;
  const at = (deps.now ?? (() => new Date()))();
  const [row] = await db.select().from(emailOutbox).where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, 'failed')));
  if (!row || row.textBody === null || row.htmlBody === null) return { ok: false, reason: 'not_found' };
  // Claim the attempt first, so a double click or a second admin cannot send it twice.
  const claimed = await db
    .update(emailOutbox)
    .set({ attempts: row.attempts + 1, lastAttemptAt: at })
    .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, 'failed'), eq(emailOutbox.attempts, row.attempts)))
    .returning({ id: emailOutbox.id });
  if (claimed.length === 0) return { ok: false, reason: 'not_found' };

  let resendId: string | undefined;
  try {
    resendId = await send({ to: row.to, subject: row.subject, text: row.textBody, html: row.htmlBody });
  } catch (err) {
    console.error('email retry failed', { subject: row.subject, error: message(err) });
    await db
      .update(emailOutbox)
      .set({ error: message(err) })
      .where(eq(emailOutbox.id, id))
      .catch((e) => console.error('email outbox write failed', { subject: row.subject, error: message(e) }));
    return { ok: false, reason: 'failed', error: message(err) };
  }
  // The email went out. A failed write here must not report it as unsent.
  await db
    .update(emailOutbox)
    .set({ status: 'sent', resendId, error: null, textBody: null, htmlBody: null, resolvedAt: at, resolvedBy: admin })
    .where(eq(emailOutbox.id, id))
    .catch((e) => console.error('email outbox write failed', { subject: row.subject, status: 'sent', error: message(e) }));
  return { ok: true };
}

/** Takes a failed email off the queue without sending it, and clears its body. */
export async function dismissFailed({ db, now }: Deps & { now?: () => Date }, id: string, admin: string): Promise<boolean> {
  const at = (now ?? (() => new Date()))();
  const rows = await db
    .update(emailOutbox)
    .set({ status: 'dismissed', textBody: null, htmlBody: null, resolvedAt: at, resolvedBy: admin })
    .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, 'failed')))
    .returning({ id: emailOutbox.id });
  return rows.length > 0;
}
