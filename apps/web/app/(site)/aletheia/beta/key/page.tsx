import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { KeyReveal, LostLicenseCard } from '@/components/beta/key-reveal';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Your Aletheia key',
  robots: { index: false, follow: false },
  referrer: 'same-origin',
};

export default async function KeyPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const { t } = await searchParams;
  const token = typeof t === 'string' && t ? t : undefined;

  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Aletheia · Beta" title="Your license key">
        {token ? 'You’ve been approved for the Aletheia beta. Welcome.' : undefined}
      </PageHeader>
      {token ? (
        <KeyReveal token={token} />
      ) : (
        <LostLicenseCard
          title="This link is incomplete"
          body="Open the link from your email in full. If you’ve lost it, we can email you a new one."
        />
      )}
    </div>
  );
}
