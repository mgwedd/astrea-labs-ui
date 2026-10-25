import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { getLegalDocs } from '@/lib/aletheia-docs';
import { ApplyForm } from '@/components/beta/apply/apply-form';

export const metadata: Metadata = {
  title: 'Apply for the Aletheia beta',
  description: 'Apply for the Aletheia beta for macOS.',
  robots: { index: false, follow: false },
};

// The form names the current Terms version, fetched from the Aletheia repo.
export const dynamic = 'force-dynamic';

export default async function ApplyPage() {
  const legal = await getLegalDocs();
  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Aletheia · Beta application" title="Apply for the beta">
        Four short steps. Nothing is sent until you submit on the last one, and your application counts only once you
        sign it.{' '}
        <Link href="/aletheia/beta#privacy" className="underline underline-offset-4 hover:text-foreground">
          What we keep
        </Link>
        .
      </PageHeader>
      <ApplyForm legalVersion={legal.version} />
    </div>
  );
}
