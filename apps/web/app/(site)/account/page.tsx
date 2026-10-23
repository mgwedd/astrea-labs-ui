import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@astrea/ui';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth/gate';
import { getDb } from '@/lib/licensing/db/client';
import { betaApplications, licenses } from '@/lib/licensing/db/schema';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } };

const date = (d: Date | null) => (d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : null);

export default async function AccountPage() {
  const user = await requireUser();
  const email = user.email.toLowerCase();
  const db = getDb();
  const [mine, applications] = await Promise.all([
    db.select().from(licenses).where(eq(licenses.email, email)).orderBy(desc(licenses.issuedAt)),
    db.select().from(betaApplications).where(eq(betaApplications.email, email)).orderBy(desc(betaApplications.createdAt)),
  ]);
  const now = new Date();
  const licenseStatus = (l: (typeof mine)[number]) =>
    l.revokedAt ? 'Revoked' : l.replacedBy ? 'Replaced' : l.expiresAt && l.expiresAt <= now ? 'Expired' : 'Active';

  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Account" title="Your account">
        Signed in as {email}. <a href="/auth/logout" className="underline underline-offset-4">Sign out</a>
      </PageHeader>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Licenses</CardTitle>
            <CardDescription>Licenses issued to {email}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {mine.length === 0 ? <p className="text-muted-foreground">No licenses yet.</p> : null}
            {mine.map((l) => (
              <div key={l.lid} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Aletheia {l.tier} · issued {date(l.issuedAt)} · {l.expiresAt ? `ends ${date(l.expiresAt)}` : 'does not expire'}
                </span>
                <span className="text-muted-foreground">{licenseStatus(l)}</span>
              </div>
            ))}
            {/* TODO: show the key again once there is a safe in-account flow; today it only comes by emailed single-use link. */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Requests</CardTitle>
            <CardDescription>Beta applications from {email}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {applications.length === 0 ? <p className="text-muted-foreground">No applications yet.</p> : null}
            {applications.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>Aletheia beta · {date(a.createdAt)}</span>
                <span className="capitalize text-muted-foreground">{a.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Feedback</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link href="/feedback" className="underline underline-offset-4">Send feedback</Link>
            {/* TODO: past feedback and support threads, once those exist. */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
