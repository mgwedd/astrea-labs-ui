import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const FEEDBACK_STATUSES = ['unconfirmed', 'pending_review', 'creating', 'approved', 'rejected'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

// A feedback submission. unconfirmed -> (email link) -> pending_review -> (admin)
// approved | rejected. Nothing reaches GitHub until a person approves it.
// Only the SHA-256 of the confirm token is stored.
export const feedbackSubmissions = pgTable(
  'feedback_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull().unique(),
    status: text('status', { enum: FEEDBACK_STATUSES }).notNull().default('unconfirmed'),
    email: text('email').notNull(), // lowercased; private, never put in an issue
    projectSlug: text('project_slug').notNull(),
    type: text('type', { enum: ['bug', 'feature'] }).notNull(),
    title: text('title').notNull(),
    fields: jsonb('fields').$type<Record<string, string>>().notNull(), // type-specific answers
    flagged: boolean('flagged').notNull().default(false), // contained a URL or image syntax
    flagReason: text('flag_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // confirm link expiry
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    // Approve/reject time; while status = 'creating' it is the claim time.
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    issueNumber: integer('issue_number'),
    issueUrl: text('issue_url'),
  },
  (t) => [
    index('feedback_submissions_email_created_idx').on(t.email, t.createdAt),
    index('feedback_submissions_status_idx').on(t.status),
  ],
);

export type FeedbackSubmission = typeof feedbackSubmissions.$inferSelect;
