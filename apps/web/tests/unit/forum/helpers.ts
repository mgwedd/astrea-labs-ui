import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/forum/db/schema';
import * as licensing from '@/lib/licensing/db/schema';
import type { Db, Deps, Viewer } from '@/lib/forum/service';

const MIGRATIONS = ['0011_forum.sql', '0012_forum_reports.sql'].map((f) => readFileSync(join(__dirname, '../../../drizzle', f), 'utf8'));

/** A fresh in-memory Postgres with the real forum migrations and the columns of `licenses` the gate reads. */
export async function newDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(`create table licenses (
    lid uuid primary key, email text not null, updates_opt_in boolean not null default false, tier text not null default 'beta',
    kid text not null default 'k', issued_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz,
    revoked_reason text, revoked_by text, replaced_by uuid, renewal_sent_at timestamptz, attestation_required boolean not null default false,
    attested_at timestamptz, created_at timestamptz not null default now());`);
  for (const sql of MIGRATIONS) for (const stmt of sql.split('--> statement-breakpoint')) if (stmt.trim()) await pg.exec(stmt);
  return drizzle(pg, { schema: { ...schema, ...licensing } }) as unknown as Db;
}

export const REGISTRY = [
  { slug: 'aletheia', name: 'Aletheia' },
  { slug: 'groundwork', name: 'Groundwork AI Studio' },
  { slug: 'minima', name: 'Minima' },
];

export function makeDeps(db: Db, extra: Partial<Deps> = {}): Deps {
  return { db, registry: REGISTRY, ...extra };
}

export const member = (n: string): Viewer => ({ sub: `auth0|${n}`, email: `${n}@example.com`, isAdmin: false });
export const admin: Viewer = { sub: 'auth0|admin', email: 'boss@example.com', isAdmin: true };

export const rich = (html: string) => ({ format: 'rich' as const, body: html });
export const md = (text: string) => ({ format: 'markdown' as const, body: text });
