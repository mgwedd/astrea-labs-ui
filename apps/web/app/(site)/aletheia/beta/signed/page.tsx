import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CircleCheck, Download } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@astrea/ui';
import { PageHeader } from '@/components/page-header';
import { InfoTip } from '@/components/beta/info-tip';
import { CreateAccountOffer } from '@/components/account/create-account-offer';
import { ResumeCard } from '@/components/beta/resume-card';
import { SESSION_COOKIE, betaDeps } from '@/lib/beta-access/server';
import { getSession } from '@/lib/beta-access/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Application submitted',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const NEXT_STEPS = [
  'Astrea Labs reviews your application and checks your license with the state board or NPPES.',
  'If you’re approved, we email you a single-use link to a page with your license key, the download and your signed copy.',
  'If we can’t approve it, we’ll send you a short email saying so.',
];

export default async function SignedPage() {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = cookie ? await getSession(betaDeps(), cookie) : null;
  if (session?.kind === 'signing') redirect('/aletheia/beta/sign');

  if (!session) {
    return (
      <div className="container max-w-2xl pb-16">
        <PageHeader eyebrow="Aletheia · Beta application" title="Your application" />
        <ResumeCard
          title="We can’t find your session"
          description="This page needs the browser you signed in. If you haven’t signed yet, enter your email and we’ll send a new signing link."
        />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Aletheia · Beta application" title="Application submitted">
        Thanks. Your signed application is stored, and it&apos;s now waiting for review.
      </PageHeader>
      <Card>
        <CardHeader>
          <CircleCheck className="mb-2 size-6 text-muted-foreground" aria-hidden />
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-lg">Your signed copy</CardTitle>
            <InfoTip label="your signed copy">
              We won&apos;t email it to you. It&apos;s also on the page you&apos;ll get if you&apos;re approved.
            </InfoTip>
          </div>
          <CardDescription>Download it for your records.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <p>Astrea Labs reviews your application next. If you&apos;re approved, we email you a link to your license key.</p>
          <InfoTip label="what happens next">
            <span className="flex flex-col gap-1">
              {NEXT_STEPS.map((step) => (
                <span key={step}>{step}</span>
              ))}
            </span>
          </InfoTip>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <a href="/api/beta/document?download=1" download>
              <Download data-icon="inline-start" />
              Download signed PDF
            </a>
          </Button>
        </CardFooter>
      </Card>
      {session.application.emailConfirmedAt ? <CreateAccountOffer email={session.application.email} /> : null}
    </div>
  );
}
