// Storage for drafts, signed PDFs and audit JSON. Server-only.
//
// Every store is write-once: put() never overwrites an existing path, because
// a signed record is append-only evidence.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { del as blobDel, get as blobGet, put as blobPut } from '@vercel/blob';

export type BlobStore = {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>; // never overwrites an existing path
  get(path: string): Promise<Uint8Array | null>;
  del(paths: string[]): Promise<void>;
};

export class BlobExistsError extends Error {
  override name = 'BlobExistsError';
  constructor(p: string) {
    super(`Blob already exists: ${p}`);
  }
}

/** Relative, forward-slash paths only: no empty, '.' or '..' segments. */
function checkPath(p: string): string {
  const segments = p.split('/');
  if (
    !p ||
    p.includes('\\') ||
    p.includes('\0') ||
    segments.some((s) => s === '' || s === '.' || s === '..')
  ) {
    throw new Error('Invalid blob path');
  }
  return p;
}

export function memoryBlobStore(): BlobStore {
  const files = new Map<string, Uint8Array>();
  return {
    async put(p, bytes) {
      checkPath(p);
      if (files.has(p)) throw new BlobExistsError(p);
      files.set(p, new Uint8Array(bytes));
    },
    async get(p) {
      checkPath(p);
      const b = files.get(p);
      return b ? new Uint8Array(b) : null;
    },
    async del(paths) {
      for (const p of paths) files.delete(checkPath(p));
    },
  };
}

export function localBlobStore(dir: string): BlobStore {
  const root = path.resolve(dir);
  const resolve = (p: string) => {
    const full = path.resolve(root, checkPath(p));
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid blob path');
    return full;
  };
  return {
    async put(p, bytes) {
      const full = resolve(p);
      await mkdir(path.dirname(full), { recursive: true });
      try {
        await writeFile(full, bytes, { flag: 'wx' });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') throw new BlobExistsError(p);
        throw err;
      }
    },
    async get(p) {
      try {
        return new Uint8Array(await readFile(resolve(p)));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },
    async del(paths) {
      for (const p of paths) await rm(resolve(p), { force: true });
    },
  };
}

/**
 * Private Vercel Blob. Auth is the SDK's: an explicit OIDC token with
 * BLOB_STORE_ID (VERCEL_OIDC_TOKEN on Vercel), else BLOB_READ_WRITE_TOKEN. With
 * neither, every call throws the SDK's "No blob credentials found" BlobError.
 */
export function vercelBlobStore(): BlobStore {
  return {
    async put(p, bytes, contentType) {
      checkPath(p);
      await blobPut(p, Buffer.from(bytes), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType,
      });
    },
    async get(p) {
      checkPath(p);
      // Read from origin, not the CDN cache, so a deleted draft is never served.
      const r = await blobGet(p, { access: 'private', useCache: false });
      if (r === null) return null;
      // 304 only answers an If-None-Match request, which this never sends.
      if (r.statusCode !== 200) throw new Error(`Unexpected blob response ${r.statusCode}`);
      return new Uint8Array(await new Response(r.stream).arrayBuffer());
    },
    async del(paths) {
      if (paths.length === 0) return;
      paths.forEach(checkPath);
      await blobDel(paths);
    },
  };
}

/**
 * Vercel Blob when credentials or a Vercel environment are present, and always
 * in production (where missing credentials then fail loudly at first use).
 * Local files under apps/web/.blob-local only in dev and tests.
 */
export function defaultBlobStore(): BlobStore {
  const env = process.env;
  if (env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID || env.VERCEL_ENV || env.NODE_ENV === 'production') {
    return vercelBlobStore();
  }
  return localBlobStore(path.join(process.cwd(), '.blob-local'));
}
