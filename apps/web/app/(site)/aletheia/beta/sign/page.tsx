import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  Separator,
} from '@astrea/ui';
import { PageHeader } from '@/components/page-header';
import { DocumentFrame } from '@/components/beta/document-frame';
import { InfoTip } from '@/components/beta/info-tip';
import { ResumeCard } from '@/components/beta/resume-card';
import { SignForm } from '@/components/beta/sign-form';
import type { Answers } from '@/lib/beta-access/answers';
import { SESSION_COOKIE, betaDeps } from '@/lib/beta-access/server';
import { getSession, peekSigningLink } from '@/lib/beta-access/service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Sign your application',
  robots: { index: false, follow: false },
  referrer: 'same-origin',
};

const LINK_PROBLEMS: Record<string, { title: string; body: string }> = {
  used: {
    title: 'This link has already been used',
    body: 'Signing links work once. If you didn’t finish signing, we can send you a new one.',
  },
  expired: {
    title: 'This link has expired',
    body: 'Signing links last 7 days. We can send you a new one; your answers are kept.',
  },
  unavailable: {
    title: 'We couldn’t open your document',
    body: 'Something went wrong on our side. Your link hasn’t been used: open it from your email again in a few minutes, or ask for a new one.',
  },
  invalid: {
    title: 'This link isn’t valid',
    body: 'It may have been copied incompletely. Use the newest link we emailed you, or ask for a new one.',
  },
};

type Search = Promise<{ t?: string | string[]; e?: string | string[] }>;

export default async function SignPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const t = typeof params.t === 'string' ? params.t : undefined;
  const e = typeof params.e === 'string' ? params.e : undefined;
  const deps = lazyDeps();

  // A fresh link from the email. Opening it is a POST, so link scanners that
  // fetch the URL don't use it up.
  let linkStatus: string | undefined = e;
  if (t) {
    const status = await peekSigningLink(deps(), t);
    if (status === 'valid') return <ConfirmStep token={t} />;
    linkStatus = status;
  }

  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = cookie ? await getSession(deps(), cookie) : null;
  if (session?.kind === 'signed') redirect('/aletheia/beta/signed');

  if (linkStatus) return <LinkProblem kind={linkStatus} canContinue={session?.kind === 'signing'} />;

  if (!session) {
    return (
      <Shell title="Sign your application">
        <ResumeCard description="Open the signing link we emailed you, or enter the email you applied with and we’ll send a new one." />
      </Shell>
    );
  }

  const answers = session.application.answers as Answers;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="container max-w-6xl pb-16">
      <PageHeader eyebrow="Aletheia · Beta application" title="Review and sign">
        Read the document made from your answers, then type your name in the form below it. The signature boxes in
        the document fill in when you sign.
      </PageHeader>
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-lg">Your application</CardTitle>
            <InfoTip label="what we record when you sign">
              Signing stamps your typed name and today&apos;s UTC date into the document and adds a certificate page.
              We record the time of each step, your IP address and browser, and the document&apos;s SHA-256 before and
              after signing, then seal the PDF so any later change shows.
            </InfoTip>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 p-4 pt-0 sm:p-6 sm:pt-0">
          <DocumentFrame title="Your Aletheia beta access application (PDF)" />
          <Separator />
          <SignForm expectedName={answers.fullName} today={today} />
        </CardContent>
      </Card>
    </div>
  );
}

// Built on first use, so a visit with no link and no cookie needs no database.
function lazyDeps() {
  let deps: ReturnType<typeof betaDeps> | undefined;
  return () => (deps ??= betaDeps());
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Aletheia · Beta application" title={title} />
      {children}
    </div>
  );
}

function ConfirmStep({ token }: { token: string }) {
  return (
    <Shell title="Confirm it’s you">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Continue to your document</CardTitle>
          <CardDescription>
            This confirms you control the email address you applied with, then opens your application for signing. The
            link works once.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <form method="post" action="/api/beta/sign/open">
            <input type="hidden" name="t" value={token} />
            <Button type="submit">
              Confirm and continue <ArrowRight data-icon="inline-end" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </Shell>
  );
}

function LinkProblem({ kind, canContinue }: { kind: string; canContinue?: boolean }) {
  const problem = LINK_PROBLEMS[kind] ?? LINK_PROBLEMS.invalid!;
  return (
    <Shell title={problem.title}>
      <ResumeCard title="Get a new signing link" description={problem.body}>
        {canContinue && (
          <Item variant="muted">
            <ItemContent>
              <ItemDescription className="line-clamp-none">You already have a signing session open in this browser.</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button size="sm" asChild>
                <Link href="/aletheia/beta/sign">
                  Continue signing <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </ItemActions>
          </Item>
        )}
      </ResumeCard>
    </Shell>
  );
}
