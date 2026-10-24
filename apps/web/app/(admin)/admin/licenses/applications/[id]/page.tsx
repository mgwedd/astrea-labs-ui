import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  Badge,
  Button,
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
import { getApplication } from '@/lib/beta-access/service';
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
  const { application: app, answers, consents, document: doc, reviews } = data;
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

      <Card>
        <CardHeader>
          <CardTitle>Signed agreement</CardTitle>
        </CardHeader>
        <CardContent>
          {doc ? (
            <Details
              rows={[
                ['Document', `${doc.docType} v${doc.docVersion}`],
                ['Signer', `${doc.signerName} <${doc.signerEmail}>`],
                ['Typed signature', doc.typedSignature],
                ['Signed', formatUtc(doc.signedAt)],
                ['Signer IP', doc.signerIp ?? '—'],
                ['PDF', <code key="v" className="break-all">{doc.pdfPath}</code>],
                ['PDF sha256', <code key="v" className="break-all">{doc.pdfSha256}</code>],
                ['Audit trail', <code key="v" className="break-all">{doc.auditPath}</code>],
                ['Seal', `${doc.sealAlg}, key ${doc.sealKeyId}`],
                ...(doc.supersedes ? [['Supersedes', <code key="v" className="break-all">{doc.supersedes}</code>] as Row] : []),
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Not signed yet.</p>
          )}
        </CardContent>
      </Card>

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
