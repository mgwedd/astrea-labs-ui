import type { Metadata } from 'next';
import { Alert, AlertDescription, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@astrea/ui';
import { SubmitButton } from '@/components/admin/submit-button';
import { PageHeader } from '@/components/page-header';
import { verifyUnsubscribeToken } from '@/lib/email/token';
import { confirmUnsubscribe } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } };

const RESULTS = {
  done: { text: 'You are unsubscribed from Astrea Labs emails.' },
  invalid: { text: 'This unsubscribe link is not valid. Nothing was changed.', error: true },
  expired: { text: 'This unsubscribe link has expired. Nothing was changed. Sign in and use Email preferences on your account instead.', error: true },
  failed: { text: 'Something went wrong and you may still be subscribed. Try the link again.', error: true },
} as const;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function UnsubscribePage({ searchParams }: Props) {
  const q = await searchParams;
  const t = typeof q.t === 'string' ? q.t : '';
  const r = typeof q.r === 'string' && Object.hasOwn(RESULTS, q.r) ? (q.r as keyof typeof RESULTS) : null;
  const check = t ? verifyUnsubscribeToken(t) : null;
  const result = r ? RESULTS[r] : check && !check.ok ? RESULTS[check.reason] : !t ? RESULTS.invalid : null;
  const error = result && 'error' in result;

  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Email" title="Unsubscribe" />
      {result ? (
        <Alert variant={error ? 'destructive' : 'default'} role="status">
          <AlertDescription>{result.text}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stop Astrea Labs emails?</CardTitle>
            <CardDescription>This turns off product emails and lab news for this address.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={confirmUnsubscribe}>
              <input type="hidden" name="t" value={t} />
              <SubmitButton>Unsubscribe</SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
