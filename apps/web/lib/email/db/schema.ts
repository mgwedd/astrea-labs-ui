import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Email opt-ins, one row per Auth0 user. Only the address, the Auth0 sub, the opt-in
// times and the product slugs live here. No usage or patient data, here or in Resend.
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

// One row per campaign an admin sent. The recipients come from Resend (a Broadcast
// to a topic), so no recipient list is stored here.
export const emailCampaigns = pgTable(
  'email_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject: text('subject').notNull(),
    audience: text('audience').notNull(), // 'news' or 'product:<slug>'
    sentBy: text('sent_by').notNull(), // admin email
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    broadcastId: text('broadcast_id'),
    bodyHtml: text('body_html'), // the sanitized HTML as sent, without the unsubscribe footer; null on rows from before HTML campaigns
    status: text('status', { enum: ['sent', 'failed'] }).notNull(),
  },
  (t) => [index('email_campaigns_sent_at_idx').on(t.sentAt)],
);

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
