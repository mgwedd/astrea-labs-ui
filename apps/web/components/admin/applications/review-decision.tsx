'use client';

import { useState, type ReactNode } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@astrea/ui';

type Choice = 'approve' | 'decline';

const PANELS: Record<Choice, { title: string; description: string }> = {
  approve: { title: 'Approve', description: 'Issues a beta license and emails a key link.' },
  decline: { title: 'Decline', description: 'Sends a short email. The license check is optional here.' },
};

/** Approve and Decline side by side; the chosen one opens its form below. */
export function ReviewDecision({ approve, decline }: { approve: ReactNode; decline: ReactNode }) {
  const [open, setOpen] = useState<Choice | null>(null);
  const toggle = (c: Choice) => setOpen((cur) => (cur === c ? null : c));
  const forms: Record<Choice, ReactNode> = { approve, decline };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={open === 'approve' ? 'default' : 'outline'}
            aria-expanded={open === 'approve'}
            aria-controls="review-approve"
            onClick={() => toggle('approve')}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant={open === 'decline' ? 'destructive' : 'outline'}
            aria-expanded={open === 'decline'}
            aria-controls="review-decline"
            onClick={() => toggle('decline')}
          >
            Decline
          </Button>
        </div>
        {(Object.keys(PANELS) as Choice[]).map((c) => (
          // Both stay mounted so switching keeps what was typed.
          <section
            key={c}
            id={`review-${c}`}
            aria-label={PANELS[c].title}
            className={open === c ? 'flex flex-col gap-4' : 'hidden flex-col gap-4'}
          >
            <CardDescription>{PANELS[c].description}</CardDescription>
            {forms[c]}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
