'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@astrea/ui';
import { SIGNING_CONSENT as C12 } from '@/lib/beta-access/content';
import { ConsentCheckbox } from './consent-checkbox';
import { Field, controlProps, invalidClass } from './field';

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

  const nameMatches = normalize(name) === normalize(expectedName);
  const nameHint =
    name.trim() && !nameMatches
      ? `This must match the name on your application: ${expectedName}. Capitals don’t matter.`
      : attempted && !name.trim()
        ? 'Type your full name to sign.'
        : undefined;
  const consentError = attempted && !consentAt ? 'Tick this box to sign electronically.' : undefined;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    setProblem(null);
    if (!consentAt || !nameMatches) return;

    setSending(true);
    try {
      const res = await fetch('/api/beta/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), consentEsignAt: consentAt }),
      });
      if (res.ok) {
        router.push('/aletheia/beta/signed');
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setProblem(problemFor(res.status, body.error));
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

function problemFor(status: number, error?: string): Problem {
  if (status === 400 && error === 'name_mismatch') {
    return { message: 'The name you typed doesn’t match the name on your application.' };
  }
  if (status === 400) {
    return { message: 'Something in the signature wasn’t accepted. Nothing was saved. Reload the page and try again.' };
  }
  if (status === 401) {
    return {
      message: (
        <>
          Your signing session has ended. Nothing was saved.{' '}
          <Link href="/aletheia/beta#resume" className="underline underline-offset-4">
            Get a new signing link
          </Link>
          .
        </>
      ),
    };
  }
  if (status === 403) return { message: 'Our bot check blocked this request. Nothing was saved. Reload the page and try again.' };
  if (status === 409) return { message: 'This application is already signed. Taking you to your confirmation…' };
  if (status === 502) {
    return { message: 'We couldn’t store your signed document, so nothing was saved and your application isn’t submitted yet. Please try again.' };
  }
  return { message: 'Something went wrong. Nothing was saved. Please try again.' };
}
