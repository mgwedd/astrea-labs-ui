import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Empty,
  Field,
  FieldLabel,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@astrea/ui';
import { reissueLicenseAction, revokeLicenseAction, sendKeyLinkAction } from '../actions';
import { Notice } from '@/components/admin/notice';
import { SubmitButton } from '@/components/admin/submit-button';
import { formatUtc, licenseState } from '@/lib/admin/format';
import { listApplications } from '@/lib/beta-access/service';
import { getDb } from '@/lib/licensing/db/client';
import { licenses, type License } from '@/lib/licensing/db/schema';
import { normalizeEmail } from '@/lib/licensing/service';

const STATUSES = ['submitted', 'approved', 'declined', 'draft'] as const;
type Status = (typeof STATUSES)[number];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LicensesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status: Status = STATUSES.find((s) => s === params.status) ?? 'submitted';
  const email = z.email().safeParse(typeof params.email === 'string' ? params.email.trim() : '').data;

  const db = getDb();
  const [applications, found] = await Promise.all([
    listApplications({ db }, status),
    email ? db.select().from(licenses).where(eq(licenses.email, normalizeEmail(email))).orderBy(desc(licenses.issuedAt)) : null,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Licenses</h1>
      <Notice value={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Beta applications</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <nav aria-label="Application status" className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Button key={s} asChild size="sm" variant={s === status ? 'secondary' : 'ghost'}>
                <Link href={`/admin/licenses?status=${s}`} aria-current={s === status ? 'page' : undefined} className="capitalize">
                  {s}
                </Link>
              </Button>
            ))}
          </nav>
          {applications.length === 0 ? (
            <Empty title={`No ${status} applications`} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/licenses/applications/${a.id}`} className="underline-offset-4 hover:underline">
                        {a.fullName || '(no name)'}
                      </Link>
                    </TableCell>
                    <TableCell className="break-all">{a.email}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatUtc(a.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {applications.length === 500 && <p className="text-sm text-muted-foreground">Showing the newest 500.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Look up licenses</CardTitle>
          <CardDescription>Every license issued to an email address.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form method="get" action="/admin/licenses" className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="status" value={status} />
            <Field className="flex-1">
              <FieldLabel htmlFor="lookup-email">Email</FieldLabel>
              <Input id="lookup-email" name="email" type="email" required defaultValue={email ?? ''} />
            </Field>
            <Button type="submit">Search</Button>
          </form>
          {found && found.length === 0 && <Empty title="No licenses for that email" />}
          {found && found.length > 0 && (
            <div className="flex flex-col gap-4">
              {found.map((l) => (
                <LicenseRow key={l.lid} license={l} email={email!} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LicenseRow({ license: l, email }: { license: License; email: string }) {
  const state = licenseState(l);
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="break-all font-mono text-sm">{l.lid}</CardTitle>
          <Badge variant={state === 'active' ? 'default' : 'secondary'} className="capitalize">
            {state}
          </Badge>
          <Badge variant="outline">{l.tier}</Badge>
        </div>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Issued</dt>
          <dd>{formatUtc(l.issuedAt)}</dd>
          <dt className="text-muted-foreground">Expires</dt>
          <dd>{l.expiresAt ? formatUtc(l.expiresAt) : 'Never'}</dd>
          {l.revokedAt && (
            <>
              <dt className="text-muted-foreground">Revoked</dt>
              <dd className="break-words">
                {formatUtc(l.revokedAt)} by {l.revokedBy ?? 'unknown'}: {l.revokedReason}
              </dd>
            </>
          )}
          {l.replacedBy && (
            <>
              <dt className="text-muted-foreground">Replaced by</dt>
              <dd className="break-all font-mono">{l.replacedBy}</dd>
            </>
          )}
        </dl>
      </CardHeader>
      {state === 'active' && (
        <CardContent className="flex flex-col gap-4">
          <form action={sendKeyLinkAction}>
            <input type="hidden" name="lid" value={l.lid} />
            <input type="hidden" name="email" value={email} />
            <SubmitButton variant="outline" size="sm">
              Email a new key link
            </SubmitButton>
          </form>

          <form action={reissueLicenseAction} className="flex flex-col gap-3">
            <input type="hidden" name="lid" value={l.lid} />
            <input type="hidden" name="email" value={email} />
            <Field orientation="horizontal">
              <Checkbox id={`revoke-old-${l.lid}`} name="revokeOld" />
              <FieldLabel htmlFor={`revoke-old-${l.lid}`}>Revoke this license when reissuing</FieldLabel>
            </Field>
            <Field>
              <FieldLabel htmlFor={`reissue-reason-${l.lid}`}>Reason (optional)</FieldLabel>
              <Input id={`reissue-reason-${l.lid}`} name="reason" maxLength={200} />
            </Field>
            <div>
              <SubmitButton variant="outline" size="sm">
                Reissue
              </SubmitButton>
            </div>
          </form>

          <form action={revokeLicenseAction} className="flex flex-col gap-3">
            <input type="hidden" name="lid" value={l.lid} />
            <input type="hidden" name="email" value={email} />
            <Field>
              <FieldLabel htmlFor={`revoke-reason-${l.lid}`}>Revoke reason</FieldLabel>
              <Input id={`revoke-reason-${l.lid}`} name="reason" required maxLength={200} />
            </Field>
            <div>
              <SubmitButton variant="destructive" size="sm">
                Revoke
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
