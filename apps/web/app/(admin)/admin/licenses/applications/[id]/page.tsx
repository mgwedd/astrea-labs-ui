import Link from 'next/link';
import { DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  Badge,
  Button,
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@astrea/ui';
import { approveApplication, declineApplication } from '../../../actions';
import { Details, type DetailRow as Row } from '@/components/admin/details';
import { Notice } from '@/components/admin/notice';
import { SubmitButton } from '@/components/admin/submit-button';
import { formatUtc } from '@/lib/admin/format';
import { defaultBlobStore } from '@/lib/agreements/signed/blob';
import { checkSignedDocument, getApplication, type DocumentReviewInfo, type FileCheck } from '@/lib/beta-access/service';
import type { SignedDocument } from '@/lib/licensing/db/schema';
import { getDb } from '@/lib/licensing/db/client';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await getApplication({ db: getDb() }, id);
  if (!data) notFound();
  const { application: app, answers, consents, document: doc, documents, reviews } = data;
  const check = doc ? await checkSignedDocument({ blob: defaultBlobStore() }, doc) : null;
  const earlier = await Promise.all(
    documents
      .filter((d) => d.id !== doc?.id)
      .map(async (d) => ({ doc: d, check: await checkSignedDocument({ blob: defaultBlobStore() }, d) })),
  );
  const name = answers.find((a) => a.id === 'fullName')?.value || app.email;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button asChild variant="link" className="self-start px-0">
          <Link href={`/admin/licenses?status=${app.status}`}>Back to applications</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-words text-2xl font-semibold">{name}</h1>
          <Badge variant="outline" className="capitalize">
            {app.status}
          </Badge>
        </div>
      </div>
      <Notice value={query.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
        </CardHeader>
        <CardContent>
          <Details
            rows={[
              ['Email', app.email],
              ['Started', formatUtc(app.createdAt)],
              ['Email confirmed', formatUtc(app.emailConfirmedAt)],
              ['Product updates', app.updatesOptIn ? 'Opted in' : 'No'],
              ['License', app.lid ? <code className="break-all">{app.lid}</code> : '—'],
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Answers</CardTitle>
        </CardHeader>
        <CardContent>
          <Details rows={answers.map((a) => [a.label, a.value || '—'])} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consents</CardTitle>
          <CardDescription>Each box ticked when applying, with the version and hash of the text shown.</CardDescription>
        </CardHeader>
        <CardContent>
          {consents.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <Details rows={consents.map((c) => [c.id, `v${c.version}, ticked ${formatUtc(c.tickedAt)}, sha256 ${c.sha256.slice(0, 12)}…`])} />
          )}
        </CardContent>
      </Card>

      {doc && check ? (
        <SignedDocumentCard doc={doc} check={check} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Signed agreement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not signed yet.</p>
          </CardContent>
        </Card>
      )}

      {earlier.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Earlier signatures</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {earlier.map(({ doc: d, check: c }) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  {d.docType} v{d.docVersion}, signed {formatUtc(d.signedAt)}
                </span>
                {c.pdf === 'ok' && c.audit === 'ok' ? (
                  <FileLinks id={d.id} />
                ) : (
                  <Badge variant="destructive">
                    PDF: {CHECK_LABELS[c.pdf]}. Audit trail: {CHECK_LABELS[c.audit]}.
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Decisions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {reviews.map((r) => (
              <Details
                key={r.id}
                rows={[
                  ['Decision', <span key="v" className="capitalize">{r.decision}</span>],
                  ['By', r.reviewer],
                  ['When', formatUtc(r.decidedAt)],
                  [
                    'License check',
                    r.licenseCheck
                      ? `${r.licenseCheck.source === 'nppes' ? 'NPPES' : 'State board'}, ${formatUtc(r.licenseCheck.checkedAt).slice(0, 10)}: ${r.licenseCheck.result}`
                      : '—',
                  ],
                  ['Notes', r.notes || '—'],
                ]}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {app.status === 'submitted' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Approve</CardTitle>
              <CardDescription>Issues a beta license and emails a key link.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={approveApplication}>
                <input type="hidden" name="applicationId" value={app.id} />
                <FieldGroup>
                  <LicenseCheckFields prefix="approve" today={today} required />
                  <Field>
                    <FieldLabel htmlFor="approve-notes">Notes (optional)</FieldLabel>
                    <Textarea id="approve-notes" name="notes" maxLength={2000} />
                  </Field>
                  <div>
                    <SubmitButton>Approve and issue license</SubmitButton>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decline</CardTitle>
              <CardDescription>Sends a short email. The license check is optional here.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={declineApplication}>
                <input type="hidden" name="applicationId" value={app.id} />
                <FieldGroup>
                  <LicenseCheckFields prefix="decline" today={today} />
                  <Field>
                    <FieldLabel htmlFor="decline-notes">Notes (optional)</FieldLabel>
                    <Textarea id="decline-notes" name="notes" maxLength={2000} />
                  </Field>
                  <div>
                    <SubmitButton variant="destructive">Decline</SubmitButton>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  document_created: 'Document created',
  email_confirmed: 'Email confirmed',
  document_viewed: 'Document viewed',
  consent_esign: 'Consent to sign electronically',
  signed: 'Signed',
};

const CHECK_LABELS: Record<FileCheck, string> = {
  ok: 'Matches recorded hash',
  missing: 'File missing',
  integrity: 'Does not match recorded hash',
  unavailable: "Couldn't read storage",
};

function fileHref(id: string, file: 'pdf' | 'audit', download?: boolean) {
  return `/admin/licenses/documents/${id}?file=${file}${download ? '&download=1' : ''}`;
}

function FileLinks({ id, pdf = 'ok', audit = 'ok' }: { id: string; pdf?: FileCheck; audit?: FileCheck }) {
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

function SignedDocumentCard({ doc, check }: { doc: SignedDocument; check: DocumentReviewInfo }) {
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

function LicenseCheckFields({ prefix, today, required }: { prefix: string; today: string; required?: boolean }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${prefix}-source`}>License checked against</FieldLabel>
        <Select name="source" defaultValue="board" required={required}>
          <SelectTrigger id={`${prefix}-source`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="board">State board</SelectItem>
              <SelectItem value="nppes">NPPES</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-result`}>Result{required ? '' : ' (optional)'}</FieldLabel>
        <Input id={`${prefix}-result`} name="result" required={required} maxLength={500} />
        <FieldDescription>What the lookup showed, e.g. license number and status.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-checked`}>Checked on{required ? '' : ' (optional)'}</FieldLabel>
        <Input
          id={`${prefix}-checked`}
          name="checkedOn"
          type="date"
          max={today}
          required={required}
          defaultValue={required ? today : undefined}
        />
      </Field>
    </>
  );
}
