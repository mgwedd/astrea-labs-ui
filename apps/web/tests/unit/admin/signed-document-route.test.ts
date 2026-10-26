import { beforeEach, describe, expect, it, vi } from 'vitest';

// The signed-document route serves evidence files, so it must check the admin gate first.

const requireAdmin = vi.fn();
vi.mock('@/lib/admin/gate', () => ({ requireAdmin: () => requireAdmin() }));
const readSignedFile = vi.fn();
vi.mock('@/lib/beta-access/service', () => ({ readSignedFile: (...a: unknown[]) => readSignedFile(...a) }));
vi.mock('@/lib/beta-access/server', () => ({ errType: () => 'Error' }));
vi.mock('@/lib/agreements/signed/blob', () => ({ defaultBlobStore: () => ({}) }));
vi.mock('@/lib/licensing/db/client', () => ({ getDb: () => ({}) }));

const { GET } = await import('@/app/(admin)/admin/licenses/documents/[documentId]/route');

const ID = '0b6f1d2e-3c4a-4b5c-8d6e-7f8091a2b3c4';
const call = (query: string, id = ID) =>
  GET(new Request(`https://astrealabs.test/admin/licenses/documents/${id}?${query}`), { params: Promise.resolve({ documentId: id }) });

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue(undefined);
  readSignedFile.mockReset();
});

describe('admin signed-document route', () => {
  it('stops at the gate for non-admins', async () => {
    requireAdmin.mockRejectedValue(new Error('FORBIDDEN'));
    await expect(call('file=pdf')).rejects.toThrow('FORBIDDEN');
    expect(readSignedFile).not.toHaveBeenCalled();
  });

  it('404s a bad id or file kind without reading storage', async () => {
    expect((await call('file=pdf', 'nope')).status).toBe(404);
    expect((await call('file=other')).status).toBe(404);
    expect(readSignedFile).not.toHaveBeenCalled();
  });

  it('serves a verified file inline, or as an attachment with download=1', async () => {
    readSignedFile.mockResolvedValue({ ok: true, bytes: new Uint8Array([1, 2]), filename: 'a.pdf', contentType: 'application/pdf' });
    const inline = await call('file=pdf');
    expect(inline.status).toBe(200);
    expect(inline.headers.get('content-disposition')).toBe('inline; filename="a.pdf"');
    expect(inline.headers.get('cache-control')).toBe('private, no-store');
    const saved = await call('file=pdf&download=1');
    expect(saved.headers.get('content-disposition')).toBe('attachment; filename="a.pdf"');
  });

  it('refuses a file that fails its hash check', async () => {
    readSignedFile.mockResolvedValue({ ok: false, reason: 'integrity' });
    const r = await call('file=audit');
    expect(r.status).toBe(502);
  });
});
