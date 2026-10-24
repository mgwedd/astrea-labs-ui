import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator } from '@astrea/ui';
import { PageHeader } from '@/components/page-header';
import { LostLicenseForm, ResumeSigningForm } from '@/components/beta/email-request-form';
import { InfoTip } from '@/components/beta/info-tip';
import { ApplicantPrivacyNotice } from '@/components/beta/privacy-notice';

export const metadata: Metadata = {
  title: 'Aletheia beta',
  description: 'Apply for the Aletheia beta for macOS. Open to licensed clinicians; keys are issued after review.',
};

const STEPS = [
  { title: 'Apply', body: 'Tell us about you and your practice, read how Aletheia handles patient information, and tick each attestation.' },
  { title: 'Confirm your email', body: 'We email you a link. It works once and expires in 7 days.' },
  { title: 'Sign', body: 'Review the document generated from your answers and sign it on this site. You can download your signed copy.' },
  { title: 'Review', body: 'Astrea Labs reviews your application and checks your license.' },
  { title: 'Get your key', body: 'If you’re approved, we email you a single-use link to your license key and the download.' },
];

export default function AletheiaBetaPage() {
  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Aletheia · Beta" title="Apply for the beta">
        Aletheia records, transcribes and drafts notes for your sessions, all on your Mac. The beta is for licensed
        clinicians, and pre-licensed clinicians working under a licensed supervisor.
      </PageHeader>

      <div className="flex flex-col gap-10">
        <section aria-labelledby="how-heading" className="flex flex-col gap-5">
          <h2 id="how-heading" className="text-xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs text-muted-foreground"
                >
                  {i + 1}
                </span>
                <span className="font-medium">{step.title}</span>
                <InfoTip label={step.title}>{step.body}</InfoTip>
              </li>
            ))}
          </ol>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Applying doesn&apos;t guarantee access. A key is issued only after review.</span>
            <InfoTip label="requirements">You&apos;ll need a Mac on macOS 14 or later. AI features need Apple silicon.</InfoTip>
          </p>
          <Button size="lg" className="self-start" asChild>
            <Link href="/aletheia/beta/apply">
              Apply for the beta <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card id="resume" className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Resume signing</CardTitle>
              <CardDescription>Applied but didn&apos;t sign, or your link expired? We&apos;ll email a new one.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeSigningForm />
            </CardContent>
          </Card>
          <Card id="lost-license" className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Lost your license?</CardTitle>
              <CardDescription>If you&apos;ve been approved, we&apos;ll email a new link to view your key.</CardDescription>
            </CardHeader>
            <CardContent>
              <LostLicenseForm />
            </CardContent>
          </Card>
        </div>

        <Separator />

        <ApplicantPrivacyNotice />
      </div>
    </div>
  );
}
