// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sdk = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }));
vi.mock('@vercel/blob', () => sdk);

const { BlobExistsError, defaultBlobStore, localBlobStore, memoryBlobStore, vercelBlobStore } = await import(
  '@/lib/agreements/signed/blob'
);

const bytes = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null);

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'blob-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

for (const [name, make] of [
  ['memoryBlobStore', () => memoryBlobStore()],
  ['localBlobStore', () => localBlobStore(dir)],
] as const) {
  describe(name, () => {
    it('round-trips, refuses overwrite, and deletes', async () => {
      const store = make();
      const p = 'beta-access/signed/doc-1/document.pdf';
      expect(await store.get(p)).toBeNull();
      await store.put(p, bytes('one'), 'application/pdf');
      expect(text(await store.get(p))).toBe('one');
      await expect(store.put(p, bytes('two'), 'application/pdf')).rejects.toBeInstanceOf(BlobExistsError);
      expect(text(await store.get(p))).toBe('one');
      await store.del([p, 'beta-access/missing.pdf']);
      expect(await store.get(p)).toBeNull();
    });

    it('rejects traversal and malformed paths', async () => {
      const store = make();
      const escape = `${path.basename(dir)}-escaped`;
      for (const bad of [`../${escape}`, `a/../../${escape}`, '/etc/passwd', 'a//b', 'a\\b', '', 'a/./b', 'a/']) {
        await expect(store.put(bad, bytes('x'), 'text/plain')).rejects.toThrow('Invalid blob path');
        await expect(store.get(bad)).rejects.toThrow('Invalid blob path');
      }
      expect(existsSync(path.join(dir, '..', escape))).toBe(false);
    });
  });
}

describe('vercelBlobStore', () => {
  it('puts privately with no suffix and no overwrite', async () => {
    await vercelBlobStore().put('a/b.json', bytes('{}'), 'application/json');
    expect(sdk.put).toHaveBeenCalledWith('a/b.json', Buffer.from('{}'), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'application/json',
    });
  });

  it('reads the stream into bytes, and maps not-found to null', async () => {
    sdk.get.mockResolvedValueOnce({ statusCode: 200, stream: new Response('hello').body, headers: new Headers(), blob: {} });
    expect(text(await vercelBlobStore().get('a/b.pdf'))).toBe('hello');
    expect(sdk.get).toHaveBeenCalledWith('a/b.pdf', { access: 'private', useCache: false });
    sdk.get.mockResolvedValueOnce(null);
    expect(await vercelBlobStore().get('a/c.pdf')).toBeNull();
    sdk.get.mockResolvedValueOnce({ statusCode: 304, stream: null, headers: new Headers(), blob: {} });
    await expect(vercelBlobStore().get('a/d.pdf')).rejects.toThrow('304');
  });

  it('deletes in one call and skips empty lists', async () => {
    await vercelBlobStore().del([]);
    expect(sdk.del).not.toHaveBeenCalled();
    await vercelBlobStore().del(['a/b.pdf', 'a/c.json']);
    expect(sdk.del).toHaveBeenCalledWith(['a/b.pdf', 'a/c.json']);
  });
});

describe('defaultBlobStore', () => {
  const clear = () => {
    for (const k of ['BLOB_READ_WRITE_TOKEN', 'BLOB_STORE_ID', 'VERCEL_ENV']) vi.stubEnv(k, '');
    vi.stubEnv('NODE_ENV', 'development');
  };

  it('uses local files in dev without credentials', async () => {
    clear();
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await defaultBlobStore().put('x/y.txt', bytes('hi'), 'text/plain');
    cwd.mockRestore();
    expect(existsSync(path.join(dir, '.blob-local/x/y.txt'))).toBe(true);
    expect(sdk.put).not.toHaveBeenCalled();
  });

  it.each([
    ['BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test'],
    ['VERCEL_ENV', 'preview'],
    ['NODE_ENV', 'production'],
  ])('uses Vercel Blob when %s is set', async (k, v) => {
    clear();
    vi.stubEnv(k, v);
    await defaultBlobStore().put('x/y.txt', bytes('hi'), 'text/plain');
    expect(sdk.put).toHaveBeenCalledOnce();
  });
});
