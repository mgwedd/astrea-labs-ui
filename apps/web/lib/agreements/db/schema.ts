import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { ConsentRecord } from '@/lib/licensing/db/schema';

// Simple-accept evidence. Append-only: a trigger rejects UPDATE, DELETE and
// TRUNCATE (migration 0004). Accepting again adds a new row.
export const agreementAcceptances = pgTable(
  'agreement_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agreementId: text('agreement_id').notNull(),
    version: text('version').notNull(),
    /** agreementSha256() of the exact text shown. */
    sha256: text('sha256').notNull(),
    /** Lower-cased email or an app's account id. */
    subject: text('subject').notNull(),
    /** True only when the caller proved the subject (signed-in account, verified email link). */
    subjectVerified: boolean('subject_verified').notNull(),
    /** Every ticked box, with its text hash and tick time. */
    ticks: jsonb('ticks').$type<ConsentRecord[]>().notNull(),
    shownAt: timestamp('shown_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('agreement_acceptances_subject_idx').on(t.agreementId, t.subject, t.acceptedAt)],
);

export type AgreementAcceptance = typeof agreementAcceptances.$inferSelect;
