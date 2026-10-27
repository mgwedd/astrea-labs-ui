import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/email/db/schema';
import type { Db } from '@/lib/email/sends';

// The email tables as migrations 0009, 0010 and 0014 leave them.
const CREATE_TABLES = `
create table email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  audience text not null,
  sent_by text not null,
  sent_at timestamptz not null default now(),
  status text not null,
  body_html text
);
create table email_preferences (
  auth0_sub text primary key,
  email text not null,
  product_opt_in_at timestamptz,
  news_opt_in_at timestamptz,
  product_slugs text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create table email_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references email_campaigns(id) on delete cascade,
  email text not null,
  resend_email_id text,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index email_campaign_sends_campaign_email_uq on email_campaign_sends (campaign_id, email);
create unique index email_campaign_sends_resend_email_id_uq on email_campaign_sends (resend_email_id);
create table email_suppressions (
  email text primary key,
  reason text not null,
  detail text,
  resend_email_id text,
  created_at timestamptz not null default now()
);`;

export async function emailDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(CREATE_TABLES);
  return drizzle(pg, { schema }) as unknown as Db;
}
