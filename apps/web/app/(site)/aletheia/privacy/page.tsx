import type { Metadata } from 'next';
import { AletheiaDocPage } from '@/components/aletheia-doc-page';

export const metadata: Metadata = {
  title: 'Aletheia Privacy Policy',
  description: 'The Privacy Policy for Aletheia, as published by the Aletheia project.',
};

// Fetched from the Aletheia repo (cached for an hour), never prerendered.
export const dynamic = 'force-dynamic';

export default function AletheiaPrivacyPage() {
  return <AletheiaDocPage id="privacy" />;
}
