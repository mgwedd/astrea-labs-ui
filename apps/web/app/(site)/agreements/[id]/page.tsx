import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AcceptTerms } from '@/components/agreements/accept-terms';
import { getAgreement } from '@/lib/agreements/registry';

type Props = { params: Promise<{ id: string }> };

// Public page for each simple-accept agreement. Signed agreements have their own flow.
const simple = (id: string) => {
  const def = getAgreement(id);
  return def?.level === 'accept' ? def : undefined;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const def = simple((await params).id);
  return def ? { title: def.title, robots: { index: false } } : {};
}

export default async function AgreementPage({ params }: Props) {
  const def = simple((await params).id);
  if (!def) notFound();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{def.title}</h1>
        <p className="text-sm text-muted-foreground">Version {def.version}</p>
      </header>
      <AcceptTerms definition={def} />
    </main>
  );
}
