import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/gate';
import { defaultBlobStore } from '@/lib/agreements/signed/blob';
import { errType } from '@/lib/beta-access/server';
import { readSignedFile } from '@/lib/beta-access/service';
import { getDb } from '@/lib/licensing/db/client';

export const dynamic = 'force-dynamic';

// Admin only: a signed beta agreement (?file=pdf) or its audit trail (?file=audit),
// served only when it still matches the SHA-256 recorded at signing. ?download=1 saves it.
export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  await requireAdmin();
  const { documentId } = await params;
  const url = new URL(request.url);
  const kind = url.searchParams.get('file');
  if (!z.uuid().safeParse(documentId).success || (kind !== 'pdf' && kind !== 'audit')) {
    return text('Not found', 404);
  }
  try {
    const r = await readSignedFile({ db: getDb(), blob: defaultBlobStore() }, documentId, kind);
    if (!r.ok) {
      if (r.reason === 'not_found') return text('Not found', 404);
      console.error('admin signed document unavailable', r.reason);
      return text(r.reason === 'integrity' ? 'The stored file does not match its recorded hash.' : 'The stored file is missing.', 502);
    }
    const download = url.searchParams.get('download') === '1';
    return new Response(Buffer.from(r.bytes), {
      headers: {
        'Content-Type': r.contentType,
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${r.filename}"`,
        'Content-Length': String(r.bytes.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('admin signed document failed', errType(err));
    return text('Unavailable', 502);
  }
}

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' } });
