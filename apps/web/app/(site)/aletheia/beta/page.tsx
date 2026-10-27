import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Separator, cn } from '@astrea/ui';
import { PageHeader } from '@/components/page-header';
import { AlreadyApplied } from '@/components/beta/already-applied';
import { ApplicantPrivacyNotice } from '@/components/beta/privacy-notice';

export const metadata: Metadata = {
  title: 'Aletheia beta',
  description: 'Apply for the Aletheia beta for macOS. Open to licensed clinicians; keys are issued after review.',
};

const REQUIREMENTS = [
  'You’re a licensed clinician, or pre-licensed under a licensed supervisor',
  'A Mac on macOS 14 or later with at least 8 GB of memory',
  'Apple silicon with 16 GB of memory recommended; Intel Macs work with smaller, slower models',
  'About 3 to 8 GB of free disk space, including the AI models',
];

const STEPS = [
  { title: 'Apply', body: 'Tell us about you and your practice, read how Aletheia handles patient information, and tick each attestation.' },
  { title: 'Confirm your email', body: 'We email you a link. It works once and expires in 7 days.' },
  { title: 'Sign', body: 'Review the document generated from your answers and sign it on this site. You can download your signed copy.' },
  { title: 'Review', body: 'Astrea Labs LLC reviews your application and checks your license.' },
  { title: 'Get your key', body: 'If you’re approved, we email you a single-use link to your license key and the download.' },
];

export default function AletheiaBetaPage() {
  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Aletheia · Beta" title="Apply for the beta">
        Aletheia records, transcribes and drafts notes for your sessions, all on your Mac. The beta is for licensed
        clinicians, and pre-licensed clinicians working under a licensed supervisor.
      </PageHeader>

      <div className="flex flex-col gap-12">
        <Card role="region" aria-labelledby="apply-heading" className="bg-muted/40">
          <CardHeader>
            <CardTitle id="apply-heading" className="text-base">
              Before you apply
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2.5 text-sm">
              {REQUIREMENTS.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Button size="lg" asChild>
              <Link href="/aletheia/beta/apply">
                Apply for the beta <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">Applying doesn&apos;t guarantee access. Keys are issued after review.</p>
          </CardFooter>
        </Card>

        <section aria-labelledby="how-heading" className="flex flex-col gap-5">
          <h2 id="how-heading" className="text-xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="flex flex-col">
            {STEPS.map((step, i) => {
              const last = i === STEPS.length - 1;
              return (
                <li key={step.title} className="flex gap-4">
                  <div aria-hidden className="flex w-7 shrink-0 flex-col items-center">
                    <span className="flex size-7 items-center justify-center rounded-full border font-mono text-xs">
                      {i + 1}
                    </span>
                    {!last && <span className="my-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className={cn('flex flex-col gap-1 pt-0.5', !last && 'pb-6')}>
                    <h3 className="font-medium leading-snug">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <AlreadyApplied />

        <Separator />

        <ApplicantPrivacyNotice />
      </div>
    </div>
  );
}
