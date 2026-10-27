'use client';

import { useState } from 'react';
import { Button, Input, cn } from '@astrea/ui';
import { Field, controlProps, invalidClass } from './field';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

function errorFor(status: number): string {
  if (status === 400) return 'Enter a valid email address.';
  if (status === 403) return 'Our security check didn’t accept this request. Try again in a moment; if it keeps happening, try another browser or network.';
  if (status === 429) return 'Too many requests. Please wait a few minutes and try again.';
  return 'We couldn’t send that just now. Please try again later.';
}

// Posts {email} to an endpoint that always answers 202 for a valid address, so
// the confirmation never says whether we know the address.
function EmailRequestForm({
  endpoint,
  idPrefix,
  submitLabel,
  sent,
  inline,
}: {
  endpoint: string;
  idPrefix: string;
  submitLabel: string;
  sent: (email: string) => React.ReactNode;
  /** Input and button share one row, wrapping on narrow screens. */
  inline?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const id = `${idPrefix}-email`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    if (!email) return setState({ kind: 'error', message: 'Enter your email address.' });
    setState({ kind: 'sending' });
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? { kind: 'sent', email } : { kind: 'error', message: errorFor(res.status) });
    } catch {
      setState({ kind: 'error', message: 'Couldn’t reach the server. Check your connection and try again.' });
    }
  }

  if (state.kind === 'sent') {
    return (
      <div role="status" className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{sent(state.email)}</p>
        <Button variant="link" size="sm" className="self-start px-0" onClick={() => setState({ kind: 'idle' })}>
          Use a different address
        </Button>
      </div>
    );
  }

  const error = state.kind === 'error' ? state.message : undefined;
  const input = (
    <Input
      {...controlProps(id, { error })}
      name="email"
      type="email"
      autoComplete="email"
      maxLength={254}
      placeholder="you@practice.com"
      className={cn(invalidClass, inline && 'min-w-0 flex-1 basis-60')}
    />
  );
  const button = (
    <Button
      type="submit"
      variant={inline ? 'secondary' : 'outline'}
      disabled={state.kind === 'sending'}
      className={inline ? 'shrink-0' : 'self-start'}
    >
      {state.kind === 'sending' ? 'Sending…' : submitLabel}
    </Button>
  );
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id={id} label="Email" error={error}>
        {inline ? (
          <div className="flex flex-wrap gap-2">
            {input}
            {button}
          </div>
        ) : (
          input
        )}
      </Field>
      {!inline && button}
    </form>
  );
}

type FormProps = { inline?: boolean; submitLabel?: string };

export function ResumeSigningForm({ inline, submitLabel = 'Email me a new link' }: FormProps) {
  return (
    <EmailRequestForm
      endpoint="/api/beta/resume"
      idPrefix="resume"
      inline={inline}
      submitLabel={submitLabel}
      sent={(email) => (
        <>
          If <span className="font-medium text-foreground">{email}</span> has an application waiting for a signature,
          we&apos;ve sent it a new signing link. It works once and expires in 7 days.
        </>
      )}
    />
  );
}

export function LostLicenseForm({ inline, submitLabel = 'Email me a key link' }: FormProps) {
  return (
    <EmailRequestForm
      endpoint="/api/licenses/request"
      idPrefix="lost-license"
      inline={inline}
      submitLabel={submitLabel}
      sent={(email) => (
        <>
          If <span className="font-medium text-foreground">{email}</span> has an active license, we&apos;ve sent it a
          link to view your key. It works once and expires.
        </>
      )}
    />
  );
}
