'use client';

import { useState } from 'react';
import { Button } from '@astrea/ui';

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; already: boolean }
  | { kind: 'error'; message: string };

const MESSAGES: Record<string, string> = {
  invalid: 'This link is not valid. Check that you copied all of it, or submit your feedback again.',
  expired: 'This link has expired. Please submit your feedback again.',
  failed: 'We could not confirm just now. Please press the button again in a minute.',
  blocked: 'Request blocked.',
};

export function ConfirmButton({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function confirm() {
    setState({ kind: 'working' });
    try {
      const res = await fetch('/api/feedback/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: string };
      if (res.ok) return setState({ kind: 'done', already: body.status === 'already' });
      setState({ kind: 'error', message: MESSAGES[body.status ?? ''] ?? 'Something went wrong. Please try again.' });
    } catch {
      setState({ kind: 'error', message: 'Could not reach the server. Check your connection and try again.' });
    }
  }

  if (state.kind === 'done') {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border p-6">
        <p className="font-medium">{state.already ? 'You already confirmed this.' : 'Confirmed. Thank you.'}</p>
        <p className="text-sm text-muted-foreground">
          We review every report first. If it is accepted we post it as a public issue; we may reply by email.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state.kind === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button onClick={confirm} disabled={state.kind === 'working'} className="self-start">
        {state.kind === 'working' ? 'Confirming…' : 'Confirm my submission'}
      </Button>
    </div>
  );
}
