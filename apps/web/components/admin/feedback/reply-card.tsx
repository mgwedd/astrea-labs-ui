'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, FieldLabel, Textarea } from '@astrea/ui';
import { replyToReporterAction } from '@/app/(admin)/admin/feedback/actions';
import { SubmitButton } from '@/components/admin/submit-button';
import { formatUtc } from '@/lib/admin/format';

// Starting points only: the admin edits the text before sending.
const STARTERS = [
  ['We’re on it', 'Thanks for the report. We’re looking into it and will follow up here.'],
  ['Need more detail', 'Thanks for the report. Could you tell us a bit more about what you were doing when it happened, and which version of the app you are on?'],
  ['Fixed in an update', 'Thanks for the report. This is fixed in a recent update. Please update the app and let us know if you still see it.'],
] as const;

export type ThreadMessage = { id: string; body: string; sentBy: string; sentAt: string };

/** Message the reporter: the history of what was sent, and a form to send another. `canReply` is false when there is no verified email on record. */
export function ReplyCard({
  submissionId,
  email,
  canReply,
  thread,
  notice,
}: {
  submissionId: string;
  email: string;
  canReply: boolean;
  thread: ThreadMessage[];
  notice?: { text: string; error: boolean };
}) {
  const [message, setMessage] = useState('');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Message the reporter</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          {canReply ? 'Emails the reporter. Their address stays private.' : 'No confirmed email on record, so you can’t message this reporter.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice && (
          <p role="status" className={notice.error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {notice.text}
          </p>
        )}
        {thread.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <ol className="flex flex-col gap-3" aria-label="Messages sent">
            {thread.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 rounded-md border bg-muted/50 p-3">
                <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                <p className="text-xs text-muted-foreground">
                  Sent to {email} by {m.sentBy} · {formatUtc(m.sentAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
        {canReply && (
          <form action={replyToReporterAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={submissionId} />
            <div role="group" aria-label="Starting points" className="flex flex-wrap gap-2">
              {STARTERS.map(([label, text]) => (
                <Button key={label} type="button" size="sm" variant="outline" onClick={() => setMessage(text)}>
                  {label}
                </Button>
              ))}
            </div>
            <Field>
              <FieldLabel htmlFor="reply-message">Message</FieldLabel>
              <Textarea id="reply-message" name="message" required rows={5} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              {/* TODO: confirm the sender address and where replies land. Mail goes out from the licensing sender (LICENSE_EMAIL_FROM). */}
              <p className="mr-auto text-xs text-muted-foreground">TODO: sender address and where replies land.</p>
              <SubmitButton variant="outline" disabled={message.trim() === ''}>
                Send message
              </SubmitButton>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
