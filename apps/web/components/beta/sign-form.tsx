'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, Input, Label } from '@astrea/ui';
import type { Strokes } from '@/lib/agreements/signed/drawn';
import { SIGNING_CONSENT as C12 } from '@/lib/beta-access/content';
import { ConsentCheckbox } from './consent-checkbox';
import { Field, controlProps, invalidClass } from './field';
import { SignaturePad } from './signature-pad';

// Same comparison as the server's nameKey(): case-insensitive, whitespace-normalised.
const normalize = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

type Problem = { message: React.ReactNode };

export function SignForm({ expectedName, today }: { expectedName: string; today: string }) {
  const router = useRouter();
  const [consentAt, setConsentAt] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [strokes, setStrokes] = useState<Strokes>([]);
  const [createAccount, setCreateAccount] = useState(false);

  const nameMatches = normalize(name) === normalize(expectedName);
  const nameHint =
    name.trim() && !nameMatches
      ? `This must match the name on your application: ${expectedName}. Capitals don’t matter.`
      : attempted && !name.trim()
        ? 'Type your full name to sign.'
        : undefined;
  const consentError = attempted && !consentAt ? 'Tick this box to sign electronically.' : undefined;
  const padLocked = !consentAt || !nameMatches;
  const drawnError = attempted && !padLocked && strokes.length === 0 ? 'Draw your signature to sign.' : undefined;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    setProblem(null);
    if (!consentAt || !nameMatches || strokes.length === 0) return;

    setSending(true);
    try {
      const res = await fetch('/api/beta/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), consentEsignAt: consentAt, strokes, createAccount }),
      });
      if (res.ok) {
        router.push('/aletheia/beta/signed');
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string; step?: string };
      if (body.error === 'consent_stale') setConsentAt(null);
      setProblem(problemFor(res.status, body));
      if (res.status === 409) router.push('/aletheia/beta/signed');
    } catch {
      setProblem({ message: 'Couldn’t reach the server. Nothing was saved. Check your connection and try again.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ConsentCheckbox
        block={C12}
        checked={consentAt !== null}
        onCheckedChange={(v) => setConsentAt(v ? new Date().toISOString() : null)}
        error={consentError}
      />
      <Field id="signature-name" label="Type your full name" error={nameHint}>
        <Input
          {...controlProps('signature-name', { error: nameHint })}
          aria-describedby={nameHint ? 'signature-name-error' : 'signature-name-rule'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          spellCheck={false}
          maxLength={200}
          className={invalidClass}
        />
        {!nameHint && (
          <p id="signature-name-rule" className="text-sm text-muted-foreground">
            It must match the name on your application: <span className="text-foreground">{expectedName}</span>.
            Capitals don&apos;t matter.
          </p>
        )}
      </Field>
      <SignaturePad
        id="signature-drawn"
        locked={padLocked}
        lockedHint="Tick the box and type your name to sign here"
        error={drawnError}
        onChange={setStrokes}
      />
      <div className="flex items-start gap-3">
        <Checkbox
          id="create-account"
          checked={createAccount}
          onCheckedChange={(v) => setCreateAccount(v === true)}
          className="mt-0.5"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="create-account" className="cursor-pointer text-sm font-normal leading-relaxed">
            Email me a link to create an Astrea Labs account, to join the forums, report bugs and talk with the team.
          </Label>
          <span className="text-xs text-muted-foreground">Optional</span>
        </div>
      </div>
      {problem && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {problem.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" size="lg" disabled={sending}>
          {sending ? 'Signing…' : 'Sign and apply'}
        </Button>
        <span className="text-sm text-muted-foreground">Dated {today} (UTC)</span>
      </div>
    </form>
  );
}

const SUPPORT_EMAIL = 'support@astrealabs.com';

// What failed on our side, in the signer's words. The code goes in a support email.
const SYSTEM_STEP: Record<string, string> = {
  draft: 'your unsigned document couldn’t be loaded',
  stamp: 'your signature couldn’t be added to the document',
  seal: 'the signed document couldn’t be sealed',
  storage: 'the signed document couldn’t be saved',
  database: 'the signature record couldn’t be saved',
};

const newLink = (
  <Link href="/aletheia/beta#resume" className="underline underline-offset-4">
    Get a new signing link
  </Link>
);

function problemFor(status: number, body: { error?: string; step?: string }): Problem {
  switch (body.error) {
    case 'name_mismatch':
      return { message: 'The name you typed doesn’t match the name on your application. Nothing was saved.' };
    case 'consent_stale':
      return { message: 'Your tick on the e-signature box has expired. Nothing was saved. Tick the box again, then sign.' };
    case 'not_viewed':
      return { message: 'The document hadn’t finished loading when you signed. Nothing was saved. Reload this page, wait for the document to appear, then sign.' };
    case 'terms_changed':
      return { message: <>Our terms were updated after your document was made, so it can’t be signed. Nothing was saved. {newLink} to sign the current version.</> };
    case 'already_signed':
      return { message: 'This application is already signed. Taking you to your confirmation…' };
    case 'session':
      return { message: <>Your signing session has ended. Nothing was saved. {newLink}.</> };
    case 'system': {
      const step = body.step && SYSTEM_STEP[body.step] ? body.step : 'unknown';
      const what = SYSTEM_STEP[step] ?? 'something failed';
      return {
        message: (
          <>
            A system error on our side stopped the signing: {what}. This isn’t caused by anything you entered. Nothing was
            saved and your application isn’t submitted yet. Try again in a few minutes. If it keeps happening, email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">{SUPPORT_EMAIL}</a> and quote
            code SIGN-{step.toUpperCase()}.
          </>
        ),
      };
    }
  }
  if (status === 403) return { message: 'Our security check didn’t accept this request. Nothing was saved. Try again in a moment; if it keeps happening, try another browser or network.' };
  if (status === 400) return { message: 'Your browser sent a request we couldn’t read. Nothing was saved. Reload the page and try again.' };
  return { message: `Something went wrong (error ${status}). Nothing was saved. Please try again.` };
}
