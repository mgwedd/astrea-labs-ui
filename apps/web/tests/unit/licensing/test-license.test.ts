// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/lib/licensing/db/schema';
import { testLicenses } from '@/lib/licensing/db/schema';
import { buildRevocationList, type Db } from '@/lib/licensing/service';
import {
  createTestLicense,
  listTestLicenses,
  MAX_LIVE_TEST_LICENSES,
  revealTestLicense,
  revokeTestLicense,
  TEST_LICENSE_DAYS,
} from '@/lib/licensing/test-license';
import { publicKeyFromRaw, rawPublicKey, REVOCATIONS_PREFIX, verifyLicense, verifySigned, type RevocationsPayload } from '@/lib/licensing/token';

const DAY = 86_400_000;
const key = { kid: 'test-1', privateKey: generateKeyPairSync('ed25519').privateKey };
const pub = { 'test-1': publicKeyFromRaw(rawPublicKey(key.privateKey)) };

let clock: Date;
let deps: { db: Db; key: typeof key; now: () => Date };
const nowS = () => Math.floor(clock.getTime() / 1000);

beforeEach(async () => {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  clock = new Date('2026-11-01T12:34:56.789Z');
  deps = { db: db as unknown as Db, key, now: () => clock };
});

const create = async (days: (typeof TEST_LICENSE_DAYS)[number] = 7, label = 'smoke') => {
  const r = await createTestLicense(deps, { days, label, by: 'admin@example.com' });
  if (!r.ok) throw new Error(r.error);
  return r.license;
};

describe('test licenses', () => {
  for (const days of TEST_LICENSE_DAYS) {
    it(`reveals a ${days}-day key the app accepts, the same bytes every time`, async () => {
      const l = await create(days, 'v2.64 smoke');
      const token = (await revealTestLicense(deps, l.lid))!;
      expect(await revealTestLicense(deps, l.lid)).toBe(token);
      const r = verifyLicense(token, pub, nowS());
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.payload).toMatchObject({ tier: 'test', lid: l.lid, sub: 'Test license: v2.64 smoke', iat: nowS(), exp: nowS() + days * 86_400 });
      expect(r.payload.acc).toBeUndefined();
      expect(l.lid).toMatch(/^test-[0-9a-f-]{36}$/);
    });
  }

  it(`keeps at most ${MAX_LIVE_TEST_LICENSES} live`, async () => {
    for (let i = 0; i < MAX_LIVE_TEST_LICENSES; i++) await create();
    expect(await createTestLicense(deps, { days: 1, label: 'x', by: 'a' })).toEqual({ ok: false, error: 'limit' });
    const [first] = await listTestLicenses(deps);
    await revokeTestLicense(deps, first!.lid);
    expect((await createTestLicense(deps, { days: 1, label: 'x', by: 'a' })).ok).toBe(true);
  });

  it('deletes a test license once it expires', async () => {
    const l = await create(1);
    clock = new Date(clock.getTime() + DAY);
    expect(await revealTestLicense(deps, l.lid)).toBeNull();
    expect(await listTestLicenses(deps)).toEqual([]);
    expect(await deps.db.select().from(testLicenses)).toEqual([]);
  });

  it('a revoked one is not revealed and is on the revocation list until it would have expired', async () => {
    const l = await create(3);
    expect(await revokeTestLicense(deps, l.lid)).toBe(true);
    expect(await revokeTestLicense(deps, l.lid)).toBe(false);
    expect(await revealTestLicense(deps, l.lid)).toBeNull();
    const listed = async () => {
      const r = verifySigned<RevocationsPayload>(REVOCATIONS_PREFIX, await buildRevocationList(deps), pub);
      return r.ok ? r.payload.revoked : null;
    };
    expect(await listed()).toEqual([l.lid]);
    clock = new Date(clock.getTime() + 3 * DAY);
    expect(await listed()).toEqual([]);
  });

  it('refuses other lengths', async () => {
    await expect(createTestLicense(deps, { days: 365 as 30, label: 'x', by: 'a' })).rejects.toThrow();
  });
});
