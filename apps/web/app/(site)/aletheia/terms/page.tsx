import type { Metadata } from 'next';
import { AletheiaDocPage } from '@/components/aletheia-doc-page';

export const metadata: Metadata = {
  title: 'Aletheia Terms of Service',
  description: 'The Terms of Service for Aletheia, as published by the Aletheia project.',
};

// Fetched from the Aletheia repo (cached for an hour), never prerendered.
export const dynamic = 'force-dynamic';

export default function AletheiaTermsPage() {
  return <AletheiaDocPage id="terms" />;
}
