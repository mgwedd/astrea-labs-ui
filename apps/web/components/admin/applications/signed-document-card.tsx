import { DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@astrea/ui';
import { Details, type DetailRow as Row } from '@/components/admin/details';
import { formatUtc } from '@/lib/admin/format';
import type { DocumentReviewInfo, FileCheck } from '@/lib/beta-access/service';
import type { SignedDocument } from '@/lib/licensing/db/schema';

const EVENT_LABELS: Record<string, string> = {
  document_created: 'Document created',
  email_confirmed: 'Email confirmed',
  document_viewed: 'Document viewed',
  consent_esign: 'Consent to sign electronically',
  signed: 'Signed',
};

export const CHECK_LABELS: Record<FileCheck, string> = {
  ok: 'Matches recorded hash',
  missing: 'File missing',
  integrity: 'Does not match recorded hash',
  unavailable: "Couldn't read storage",
};

function fileHref(id: string, file: 'pdf' | 'audit', download?: boolean) {
  return `/admin/licenses/documents/${id}?file=${file}${download ? '&download=1' : ''}`;
}

export function FileLinks({ id, pdf = 'ok', audit = 'ok' }: { id: string; pdf?: FileCheck; audit?: FileCheck }) {
  return (
    <div className="flex flex-wrap gap-2">
      {pdf === 'ok' && (
        <>
          <Button asChild size="sm">
            <a href={fileHref(id, 'pdf')} target="_blank" rel="noopener">
              <ExternalLinkIcon data-icon="inline-start" />
              View PDF
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={fileHref(id, 'pdf', true)}>
              <DownloadIcon data-icon="inline-start" />
              Download PDF
            </a>
          </Button>
        </>
      )}
      {audit === 'ok' && (
        <Button asChild size="sm" variant="outline">
          <a href={fileHref(id, 'audit', true)}>
            <DownloadIcon data-icon="inline-start" />
            Audit trail (JSON)
          </a>
        </Button>
      )}
    </div>
  );
}

function HashCheck({ check, sha256 }: { check: FileCheck; sha256: string }) {
  return (
    <span className="flex flex-col gap-1">
      <Badge variant={check === 'ok' ? 'secondary' : 'destructive'} className="self-start">
        {CHECK_LABELS[check]}
      </Badge>
      <code className="break-all text-xs">{sha256}</code>
    </span>
  );
}

export function SignedDocumentCard({ doc, check }: { doc: SignedDocument; check: DocumentReviewInfo }) {
  const failed = check.pdf !== 'ok' || check.audit !== 'ok';
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signed agreement</CardTitle>
        <CardDescription>
          {doc.docType} v{doc.docVersion}, signed {formatUtc(doc.signedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {failed && (
          <Alert variant="destructive">
            <AlertTitle>Stored files failed the check</AlertTitle>
            <AlertDescription>
              PDF: {CHECK_LABELS[check.pdf]}. Audit trail: {CHECK_LABELS[check.audit]}. Don&apos;t approve on this record.
            </AlertDescription>
          </Alert>
        )}
        <FileLinks id={doc.id} pdf={check.pdf} audit={check.audit} />
        <Details
          rows={[
            ['Signer', `${doc.signerName} <${doc.signerEmail}>`],
            ['Typed signature', doc.typedSignature],
            ['Email confirmed', formatUtc(doc.emailConfirmedAt)],
            ['Signer IP', doc.signerIp ?? '—'],
            ['Browser', check.signerUa ? <span key="v" className="break-all">{check.signerUa}</span> : '—'],
            ['PDF', <HashCheck key="v" check={check.pdf} sha256={doc.pdfSha256} />],
            ['Audit trail', <HashCheck key="v" check={check.audit} sha256={doc.auditSha256} />],
            ['Seal', `${doc.sealAlg}, key ${doc.sealKeyId}`],
            ['Document ID', <code key="v" className="break-all">{doc.id}</code>],
            ...(doc.supersedes ? [['Supersedes', <code key="v" className="break-all">{doc.supersedes}</code>] as Row] : []),
          ]}
        />
        {check.events.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Signing events</h3>
            <Details rows={check.events.map((e) => [EVENT_LABELS[e.type] ?? e.type, formatUtc(e.at)])} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
