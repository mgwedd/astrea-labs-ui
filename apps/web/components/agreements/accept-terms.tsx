'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Input } from '@astrea/ui';
import type { AgreementDefinition } from '@/lib/agreements/define';
import { EmailSchema } from '@/lib/agreements/validation';
import { ConsentCheckbox } from '@/components/beta/consent-checkbox';
import { Field, controlProps, invalidClass } from '@/components/beta/field';
import { RichText } from '@/components/beta/rich-text';

const validEmail = (v: string) => EmailSchema.safeParse(v).success;

// Simple accept: the terms, one unticked box each, an email and an accept button.
// Records when the terms were shown and when each box was ticked.
export function AcceptTerms({ definition }: { definition: AgreementDefinition }) {
  const [shownAt] = useState(() => new Date().toISOString());
  const [ticked, setTicked] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (acceptedAt) statusRef.current?.focus();
  }, [acceptedAt]);

  const missing = definition.checkboxes.filter((b) => !b.optional && !ticked[b.id]).map((b) => b.id);
  const emailError = attempted && !validEmail(email) ? 'Enter your email address.' : undefined;

  function toggle(id: string, on: boolean) {
    setTicked((prev) => {
      const next = { ...prev };
      if (on) next[id] = new Date().toISOString();
      else delete next[id];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    setProblem(null);
    if (missing.length > 0 || !validEmail(email)) {
      // Errors are tied to their controls with aria-describedby, so focusing the first one reads its error.
      const first = missing[0] ? `consent-${missing[0]}` : 'accept-email';
      document.getElementById(first)?.focus();
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/agreements/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementId: definition.id, version: definition.version, email: email.trim(), shownAt, tickedAt: ticked, sentAt: new Date().toISOString() }),
      });
      const body = (await res.json().catch(() => ({}))) as { acceptedAt?: string; error?: string };
      if (res.ok && body.acceptedAt) setAcceptedAt(body.acceptedAt);
      else setProblem(problemFor(res.status, body.error));
    } catch {
      setProblem('Couldn’t reach the server. Nothing was saved. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  if (acceptedAt) {
    return (
      <p ref={statusRef} role="status" tabIndex={-1} className="text-sm outline-none">
        Accepted {definition.title}, version {definition.version}, at {acceptedAt.slice(0, 16).replace('T', ' ')} UTC.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {definition.terms.map((b) => (
          <section key={b.id} className="flex flex-col gap-1.5">
            {b.title && <h2 className="text-base font-semibold">{b.title}</h2>}
            <p className="text-sm leading-relaxed text-muted-foreground">
              <RichText text={b.text} />
            </p>
          </section>
        ))}
      </div>
      <div className="flex flex-col">
        {definition.checkboxes.some((b) => !b.optional) && (
          <p className="text-sm text-muted-foreground">All boxes are required unless marked optional.</p>
        )}
        <div className="flex flex-col divide-y">
        {definition.checkboxes.map((b) => (
          <ConsentCheckbox
            key={b.id}
            block={b}
            optional={b.optional}
            checked={Boolean(ticked[b.id])}
            onCheckedChange={(on) => toggle(b.id, on)}
            error={attempted && missing.includes(b.id) ? 'Tick this box to accept.' : undefined}
          />
        ))}
        </div>
      </div>
      <Field id="accept-email" label="Email" error={emailError}>
        <Input
          {...controlProps('accept-email', { error: emailError })}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          className={invalidClass}
        />
      </Field>
      {problem && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" size="lg" disabled={sending}>
          {sending ? 'Accepting…' : 'Accept'}
        </Button>
        <span className="text-sm text-muted-foreground">Version {definition.version}</span>
      </div>
    </form>
  );
}

function problemFor(status: number, error?: string): string {
  if (status === 409 || error === 'stale_version') return 'These terms were updated while the page was open. Reload to read the new version.';
  if (status === 429) return 'Too many attempts. Try again in an hour.';
  if (status === 403) return 'Our security check didn’t accept this request. Nothing was saved. Try again in a moment; if it keeps happening, try another browser or network.';
  if (status === 400) return 'Something wasn’t accepted. Nothing was saved. Reload the page and try again.';
  return 'Something went wrong. Nothing was saved. Please try again.';
}
