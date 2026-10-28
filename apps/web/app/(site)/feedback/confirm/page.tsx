import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { ConfirmButton } from '@/components/feedback/confirm-button';

export const metadata: Metadata = { title: 'Confirm feedback', robots: { index: false, follow: false }, referrer: 'same-origin' };

// Opening this page changes nothing. Only the button (a POST) confirms,
// so email link scanners that fetch the URL cannot trigger it.
export default async function ConfirmFeedbackPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Feedback" title="Confirm your submission">
        Press the button to confirm. We review every report before anything is posted publicly, and your email address is never included.
      </PageHeader>
      {token ? (
        <ConfirmButton token={token} />
      ) : (
        <p className="text-sm text-muted-foreground">This link is missing its token. Open the link from your email again.</p>
      )}
    </div>
  );
}
