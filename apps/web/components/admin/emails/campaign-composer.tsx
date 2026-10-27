'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from '@astrea/ui';
import { previewCampaign, sendCampaign, sendTestCampaign, type PreviewState } from '@/app/(admin)/admin/emails/actions';
import { SubmitButton } from '@/components/admin/submit-button';

type Option = { value: string; label: string };

const MAX_FILE_BYTES = 200_000;

// Keeps remote loads out of the preview: only https images, inline styles.
const PREVIEW_CSP = "default-src 'none'; img-src https:; style-src 'unsafe-inline'";

/**
 * The email as it will be sent, in an isolated frame. This is a deliberate exception to the
 * "no bare <iframe>" rule: the HTML is admin-authored and only sanitized on the server, and
 * `sandbox=""` (no allow-scripts, no allow-same-origin) plus the CSP above guarantee it can't
 * run script, read this page or its cookies, submit forms or navigate the admin page.
 * Rendering it inline would put its styles and markup into the admin page itself.
 */
function EmailFrame({ html, narrow }: { html: string; narrow: boolean }) {
  return (
    <iframe
      title="Email preview"
      sandbox=""
      srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><base target="_blank">${html}`}
      className={cn('h-[480px] max-w-full self-center rounded-md border bg-white', narrow ? 'w-[375px]' : 'w-full')}
    />
  );
}

export function CampaignComposer({ audiences, onDiscard }: { audiences: Option[]; onDiscard?: () => void }) {
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [audience, setAudience] = useState(audiences[0]?.value ?? '');
  const [preview, setPreview] = useState<PreviewState>(null);
  const [narrow, setNarrow] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const label = audiences.find((a) => a.value === audience)?.label ?? audience;
  const ready = subject.trim() !== '' && html.trim() !== '' && audience !== '';

  // Live preview: the server sanitizes and appends the footer, so what shows is what is sent.
  useEffect(() => {
    if (html.trim() === '') {
      setPreview(null);
      return;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      const form = new FormData();
      form.set('html', html);
      const result = await previewCampaign(null, form);
      if (!stale) setPreview(result);
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [html]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`That file is over ${MAX_FILE_BYTES / 1000} KB.`);
    } else {
      setFileError(null);
      setHtml(await file.text());
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <form ref={formRef} className="flex min-w-0 flex-col gap-6" action={sendTestCampaign}>
      <div className="flex flex-wrap gap-4">
        <Field className="min-w-60 flex-[2_1_20rem]">
          <FieldLabel htmlFor="campaign-subject">Subject</FieldLabel>
          <Input id="campaign-subject" name="subject" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field className="min-w-60 flex-1">
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
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <FieldGroup>
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="campaign-html">HTML</FieldLabel>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload data-icon="inline-start" aria-hidden />
                Upload .html
              </Button>
              <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="sr-only" tabIndex={-1} aria-label="Upload an HTML file" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <Textarea
              id="campaign-html"
              name="html"
              required
              rows={18}
              maxLength={200_000}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder="Paste the HTML of the email, or upload a .html file."
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
            <FieldDescription>
              The unsubscribe footer is added on send. Don’t include one. Scripts, forms, iframes, style blocks and non-https links and images are removed.
            </FieldDescription>
            {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
          </Field>
        </FieldGroup>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Preview</h2>
            <ToggleGroup type="single" variant="outline" size="sm" value={narrow ? 'mobile' : 'desktop'} onValueChange={(v) => v && setNarrow(v === 'mobile')} aria-label="Preview width">
              <ToggleGroupItem value="desktop">Desktop</ToggleGroupItem>
              <ToggleGroupItem value="mobile">Mobile</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {preview && 'error' in preview ? (
            <Alert variant="destructive">
              <AlertDescription>{preview.error}</AlertDescription>
            </Alert>
          ) : preview ? (
            <>
              <EmailFrame html={preview.html} narrow={narrow} />
              <p className="text-xs text-muted-foreground">The unsubscribe and preferences links at the bottom are added to every send. Here they are stand-ins.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">The preview appears here as you type.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <SubmitButton variant="outline" disabled={!ready}>
          Send test to me
        </SubmitButton>
        <Button type="button" disabled={!ready} onClick={() => setConfirming(true)}>
          Review and send
        </Button>
        <button ref={sendRef} type="submit" formAction={sendCampaign} hidden />
        <Button
          type="button"
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            setSubject('');
            setHtml('');
            setFileError(null);
            onDiscard?.();
          }}
        >
          Discard
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {label}?</AlertDialogTitle>
            <AlertDialogDescription>“{subject}” goes to every {label} subscriber now. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => formRef.current?.requestSubmit(sendRef.current)}>Send campaign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
