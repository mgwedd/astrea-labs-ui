'use client';

import { useActionState, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@astrea/ui';
import { previewCampaign, sendCampaign, sendTestCampaign, type PreviewState } from '@/app/(admin)/admin/emails/actions';
import { SubmitButton } from '@/components/admin/submit-button';

type Option = { value: string; label: string };

export function CampaignComposer({ audiences }: { audiences: Option[] }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState(audiences[0]?.value ?? '');
  const [preview, previewAction] = useActionState<PreviewState, FormData>(previewCampaign, null);
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const label = audiences.find((a) => a.value === audience)?.label ?? audience;
  const ready = subject.trim() !== '' && body.trim() !== '' && audience !== '';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form ref={formRef} className="min-w-0" action={previewAction}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="campaign-subject">Subject</FieldLabel>
            <Input id="campaign-subject" name="subject" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="campaign-audience">Audience</FieldLabel>
            <Select value={audience} onValueChange={setAudience} name="audience">
              <SelectTrigger id="campaign-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {audiences.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Only contacts opted in to this topic receive it.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="campaign-body">Body (Markdown)</FieldLabel>
            <Textarea id="campaign-body" name="body" required rows={14} className="font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="outline">Preview</SubmitButton>
            <SubmitButton variant="outline" formAction={sendTestCampaign}>
              Send test to me
            </SubmitButton>
            <Button type="button" disabled={!ready} onClick={() => setConfirming(true)}>
              Send campaign
            </Button>
            <button ref={sendRef} type="submit" formAction={sendCampaign} hidden />
          </div>
        </FieldGroup>
      </form>

      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sm font-medium">Preview</h2>
        {preview && 'error' in preview ? (
          <Alert variant="destructive">
            <AlertDescription>{preview.error}</AlertDescription>
          </Alert>
        ) : preview ? (
          <div
            className="prose prose-sm max-w-none overflow-x-auto rounded-md border p-4 dark:prose-invert"
            // Sanitized on the server by renderMarkdown (sanitize-html allowlist).
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Press Preview to see the email as it will be sent.</p>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Audience: {label}. Subject: {subject}. It goes to every contact opted in to this topic and cannot be recalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => formRef.current?.requestSubmit(sendRef.current)}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
