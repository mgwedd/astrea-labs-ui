import type { Metadata } from 'next';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@astrea/ui';
import { PageHeader } from '@/components/page-header';
import { peekInvite } from '@/lib/accounts/invites';
import { getDb } from '@/lib/licensing/db/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create your account', robots: { index: false, follow: false }, referrer: 'same-origin' };

const PROBLEMS: Record<string, string> = {
  used: 'This link was already used. If you finished creating your account, sign in instead.',
  expired: 'This link has expired.',
  invalid: 'This link isn’t valid.',
  failed: 'We couldn’t create the account just now. Try the button again in a minute.',
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ t?: string; e?: string }> }) {
  const { t, e } = await searchParams;
  const state = await peekInvite({ db: getDb() }, t);
  const problem = state === 'valid' ? (e === 'failed' ? PROBLEMS.failed : null) : PROBLEMS[state];

  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Account" title="Create your account" />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{state === 'valid' ? 'Set up your account' : 'We can’t use this link'}</CardTitle>
          <CardDescription>
            {state === 'valid'
              ? 'Your account uses the email you applied with. Next we email you a one-time code to sign in. There is no password.'
              : 'Accounts are created from the link we email after you request a license.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {problem ? <p role="alert" className="text-sm text-destructive">{problem}</p> : null}
          {state === 'valid' ? (
            <form method="post" action="/api/account/join">
              <input type="hidden" name="t" value={t} />
              <Button type="submit">Create account</Button>
            </form>
          ) : (
            <Button asChild variant="outline" className="self-start">
              <a href="/auth/login?returnTo=%2Faccount">Sign in</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
