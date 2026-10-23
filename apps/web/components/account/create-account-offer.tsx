'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@astrea/ui';

type State = 'idle' | 'sending' | 'sent' | 'error';

// Posts to an endpoint that always answers 202 for an eligible session, so the confirmation
// never reveals whether an account or invite already exists.
export function CreateAccountOffer({ email }: { email: string }) {
  const [state, setState] = useState<State>('idle');

  async function onClick() {
    setState('sending');
    try {
      const res = await fetch('/api/account/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Create an account (optional)</CardTitle>
        <CardDescription>See your licenses and applications in one place, and find the feedback form.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {state === 'sent' ? (
          <p role="status" className="text-sm text-muted-foreground">
            If this address can have an account, we sent a link to {email}. It works once and expires in 7 days.
          </p>
        ) : (
          <>
            <Button onClick={onClick} disabled={state === 'sending'} variant="outline" className="self-start">
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </Button>
            {state === 'error' ? (
              <p role="alert" className="text-sm text-destructive">
                We couldn’t send that just now. Please try again later.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">We email {email} a link to create your account. Skip this and nothing changes.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
