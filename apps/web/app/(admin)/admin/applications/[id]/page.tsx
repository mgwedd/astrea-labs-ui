import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldGroup,
  FieldLabel,
  Textarea,
} from '@astrea/ui';
import { approveApplication, declineApplication } from '../../actions';
import { ApplicationList } from '@/components/admin/applications/application-list';
import { LicenseCheckFields } from '@/components/admin/applications/license-check-fields';
import { CHECK_LABELS, FileLinks, SignedDocumentCard, auditOk } from '@/components/admin/applications/signed-document-card';
import { StatusNav } from '@/components/admin/applications/status-nav';
import { Details } from '@/components/admin/details';
import { Notice } from '@/components/admin/notice';
import { SubmitButton } from '@/components/admin/submit-button';
import { formatUtc } from '@/lib/admin/format';
import { requireAdmin } from '@/lib/admin/gate';
import { defaultBlobStore } from '@/lib/agreements/signed/blob';
import { checkSignedDocument, getApplication, listApplications } from '@/lib/beta-access/service';
import { getDb } from '@/lib/licensing/db/client';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationPage({ params, searchParams }: Props) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const data = await getApplication({ db }, id);
  if (!data) notFound();
  const { application: app, answers, consents, document: doc, documents, reviews } = data;
  const [siblings, check, earlier] = await Promise.all([
    listApplications({ db }, app.status),
    doc ? checkSignedDocument({ blob: defaultBlobStore() }, doc) : null,
    Promise.all(
      documents
        .filter((d) => d.id !== doc?.id)
        .map(async (d) => ({ doc: d, check: await checkSignedDocument({ blob: defaultBlobStore() }, d) })),
    ),
  ]);
  const name = answers.find((a) => a.id === 'fullName')?.value || app.email;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Beta applications</h1>
      <Notice value={query.notice} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-label="Applications" className="flex flex-col gap-3">
          <StatusNav status={app.status} />
          <div className="max-h-96 overflow-y-auto rounded-xl border lg:max-h-[calc(100vh-14rem)]">
            <ApplicationList rows={siblings} selectedId={app.id} empty={`No ${app.status} applications`} />
          </div>
        </section>

        <section aria-label="Application detail" className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-xl font-semibold">{name}</h2>
            <Badge variant="outline" className="capitalize">
              {app.status}
            </Badge>
          </div>

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
                <Details
                  rows={consents.map((c) => [c.id, `v${c.version}, ticked ${formatUtc(c.tickedAt)}, sha256 ${c.sha256.slice(0, 12)}…`])}
                />
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
                    {c.pdf === 'ok' && auditOk(c.audit) ? (
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
            <div className="grid gap-6 xl:grid-cols-2">
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
        </section>
      </div>
    </div>
  );
}
