import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { FeedbackForm } from '@/components/feedback/feedback-form';
import { prefillFrom } from '@/lib/feedback/prefill';

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Request a feature or report a bug in an Astrea Labs project.',
};

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const prefill = prefillFrom(await searchParams);
  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Feedback" title="Request a feature or report a bug">
        Confirm your email, and we&apos;ll review your report before it is posted as a public issue in the project&apos;s GitHub repository.
      </PageHeader>
      <FeedbackForm prefill={prefill} />
      <p className="mt-10 text-sm text-muted-foreground">
        We use your email only to confirm the submission and reply. See the{' '}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          privacy notice
        </Link>
        .
      </p>
    </div>
  );
}
