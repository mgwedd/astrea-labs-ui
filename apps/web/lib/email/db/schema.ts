import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Postgres owns all email state: who opted in, who is suppressed, what was sent to whom.
// Resend only delivers. Email opt-ins: one row per Auth0 user. Only the address, the Auth0
// sub, the opt-in times and the product slugs live here. No usage or patient data.
export const emailPreferences = pgTable(
  'email_preferences',
  {
    auth0Sub: text('auth0_sub').primaryKey(),
    email: text('email').notNull(), // lowercased
    productOptInAt: timestamp('product_opt_in_at', { withTimezone: true }), // null = off
    newsOptInAt: timestamp('news_opt_in_at', { withTimezone: true }), // null = off
    productSlugs: text('product_slugs').array().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('email_preferences_email_idx').on(t.email)],
);

export type EmailPreferences = typeof emailPreferences.$inferSelect;

// One row per campaign an admin sent. Its recipients are the email_campaign_sends rows.
// Rows from before email_campaign_sends existed (Resend Broadcasts) have no sends.
export const emailCampaigns = pgTable(
  'email_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject: text('subject').notNull(),
    audience: text('audience').notNull(), // 'news' or 'product:<slug>'
    sentBy: text('sent_by').notNull(), // admin email
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    bodyHtml: text('body_html'), // the sanitized HTML as sent, without the unsubscribe footer; null on rows from before HTML campaigns
    // sending: in progress. partial: some recipients failed. failed: none were sent.
    status: text('status', { enum: ['sending', 'sent', 'partial', 'failed'] }).notNull(),
  },
  (t) => [index('email_campaigns_sent_at_idx').on(t.sentAt)],
);

export type EmailCampaign = typeof emailCampaigns.$inferSelect;

export const SEND_STATUSES = ['queued', 'sent', 'failed', 'delivered', 'bounced', 'complained', 'suppressed'] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

// One row per recipient per campaign. An address appears once per campaign, so a retry
// can't email anyone twice. Webhook events move the status on from 'sent'.
export const campaignSends = pgTable(
  'email_campaign_sends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: 'cascade' }),
    email: text('email').notNull(), // lowercased
    resendEmailId: text('resend_email_id'),
    status: text('status', { enum: SEND_STATUSES }).notNull().default('queued'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('email_campaign_sends_campaign_email_uq').on(t.campaignId, t.email),
    uniqueIndex('email_campaign_sends_resend_email_id_uq').on(t.resendEmailId),
    index('email_campaign_sends_email_idx').on(t.email),
  ],
);

export type CampaignSend = typeof campaignSends.$inferSelect;

// Addresses campaigns never go to again: hard bounces, spam complaints, and addresses
// Resend reports it suppressed. Opting back in on /account does not clear a row.
export const emailSuppressions = pgTable('email_suppressions', {
  email: text('email').primaryKey(), // lowercased
  reason: text('reason', { enum: ['bounce', 'complaint', 'resend_suppressed'] }).notNull(),
  detail: text('detail'),
  resendEmailId: text('resend_email_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type EmailSuppression = typeof emailSuppressions.$inferSelect;

// Every transactional email (license links, application and feedback notices), sent or not.
// A failed row keeps the message so an admin can retry it from /admin/emails; the body is
// cleared once it is sent or dismissed. Campaigns are logged in email_campaigns instead.
export const EMAIL_OUTBOX_STATUSES = ['sent', 'failed', 'dismissed'] as const;
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    to: text('to').notNull(),
    subject: text('subject').notNull(),
    status: text('status', { enum: EMAIL_OUTBOX_STATUSES }).notNull(),
    error: text('error'), // the last failure, as Resend reported it
    attempts: integer('attempts').notNull().default(1),
    resendId: text('resend_id'),
    textBody: text('text_body'), // kept only while failed
    htmlBody: text('html_body'), // kept only while failed
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }), // when a failed row was retried or dismissed
    resolvedBy: text('resolved_by'), // admin email
  },
  (t) => [index('email_outbox_status_created_idx').on(t.status, t.createdAt)],
);

export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
