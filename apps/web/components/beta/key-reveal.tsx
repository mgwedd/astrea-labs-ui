'use client';

import { useState } from 'react';
import { ALETHEIA_RENEWAL } from '@/lib/beta-access/content';
import { ConsentCheckbox } from './consent-checkbox';
import { AppWindow, Copy, Download, FileText, KeyRound } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
  toast,
} from '@astrea/ui';
import { InfoTip } from './info-tip';
import { LostLicenseForm } from './email-request-form';

type Revealed = { token: string; expiresAt: string | null; downloadUrl: string; hasDocument: boolean };
type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'attest'; shownAt: string; tickedAt: string | null; sending: boolean; error?: string }
  | { kind: 'shown'; key: Revealed }
  | { kind: 'gone'; reason: string }
  | { kind: 'error'; message: string };

const GONE: Record<string, { title: string; body: string }> = {
  used: { title: 'This link has already been used', body: 'Key links work once, so your key can’t be shown again here.' },
  expired: { title: 'This link has expired', body: 'Key links expire for safety.' },
  invalid: { title: 'This link isn’t valid', body: 'It may have been copied incompletely.' },
};

// Handled by Aletheia itself: it checks the key offline and asks before
// replacing the current one. Nothing is sent anywhere.
const openInAppUrl = (key: string) => `aletheia://license?key=${encodeURIComponent(key)}`;

const C2 = ALETHEIA_RENEWAL.checkboxes[0];

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));

export function KeyReveal({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  // A renewed key needs C2 confirmed again: the server answers 409 and the
  // link stays unused until the box is ticked and sent.
  async function reveal(attestation?: { shownAt: string; tickedAt: string }) {
    if (attestation) setState({ kind: 'attest', ...attestation, sending: true });
    else setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/beta/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: token,
          ...(attestation && {
            attestation: {
              version: ALETHEIA_RENEWAL.version,
              shownAt: attestation.shownAt,
              tickedAt: { [C2.id]: attestation.tickedAt },
              sentAt: new Date().toISOString(),
            },
          }),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<Revealed> & { error?: string };
      if (res.ok && body.token) return setState({ kind: 'shown', key: body as Revealed });
      if (res.status === 410) return setState({ kind: 'gone', reason: body.error ?? 'invalid' });
      if (res.status === 409) {
        return setState({ kind: 'attest', shownAt: new Date().toISOString(), tickedAt: null, sending: false });
      }
      if (res.status === 400 && attestation) {
        return setState({
          kind: 'attest',
          shownAt: new Date().toISOString(),
          tickedAt: null,
          sending: false,
          error: 'We couldn’t record your confirmation. Reload the page and try again.',
        });
      }
      setState({ kind: 'error', message: 'Something went wrong on our side. Please try again in a few minutes.' });
    } catch {
      setState({ kind: 'error', message: 'Couldn’t reach the server. Check your connection and try again.' });
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Key copied');
    } catch {
      toast.error('Couldn’t copy. Select the key and copy it by hand.');
    }
  }

  if (state.kind === 'gone') {
    const gone = GONE[state.reason] ?? GONE.invalid!;
    return <LostLicenseCard title={gone.title} body={`${gone.body} If you’ve lost your key, we can email you a new link.`} />;
  }

  if (state.kind === 'attest') {
    const { shownAt, tickedAt, sending, error } = state;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{ALETHEIA_RENEWAL.title}</CardTitle>
          <CardDescription>
            Your license has been renewed. Confirm this again to see your new key. If you don’t, your current key ends on
            its usual date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsentCheckbox
            block={C2}
            checked={tickedAt !== null}
            onCheckedChange={(v) =>
              setState({ kind: 'attest', shownAt, tickedAt: v ? new Date().toISOString() : null, sending: false })
            }
            error={error}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={() => tickedAt && reveal({ shownAt, tickedAt })} disabled={!tickedAt || sending}>
            {sending ? 'Confirming…' : 'Confirm and show my key'}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (state.kind === 'shown') {
    const { key } = state;
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your license key</CardTitle>
            <CardDescription>
              Open it in Aletheia, or paste it into Settings → License key.{' '}
              {key.expiresAt ? `Valid until ${formatDate(key.expiresAt)} (UTC).` : 'It has no end date.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Label htmlFor="license-key" className="sr-only">
              License key
            </Label>
            <Textarea
              id="license-key"
              value={key.token}
              readOnly
              rows={4}
              spellCheck={false}
              onFocus={(e) => e.currentTarget.select()}
              className="resize-none break-all font-mono text-xs"
            />
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">This page shows your key once.</span> Copy it now.
              </span>
              <InfoTip label="keeping your key">
                If you lose it, use &ldquo;Lost your license?&rdquo; on the beta page to get a new link. Your key is
                personal: don&apos;t share it.
              </InfoTip>
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={openInAppUrl(key.token)}>
                <AppWindow data-icon="inline-start" />
                Open in Aletheia
              </a>
            </Button>
            <Button variant="outline" onClick={() => copy(key.token)}>
              <Copy data-icon="inline-start" />
              Copy key
            </Button>
            <Button variant="outline" asChild>
              <a href={key.downloadUrl}>
                <Download data-icon="inline-start" />
                Download Aletheia
              </a>
            </Button>
            {key.hasDocument && (
              <Button variant="ghost" asChild>
                <a href="/api/beta/document?download=1" download>
                  <FileText data-icon="inline-start" />
                  Signed application (PDF)
                </a>
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <KeyRound className="mb-2 size-6 text-muted-foreground" aria-hidden />
        <CardTitle className="text-lg">Your key is ready</CardTitle>
        <CardDescription>
          The key is shown once, on this page. Make sure you can copy it somewhere safe before you continue.
        </CardDescription>
      </CardHeader>
      {state.kind === 'error' && (
        <CardContent>
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        </CardContent>
      )}
      <CardFooter>
        <Button onClick={() => reveal()} disabled={state.kind === 'loading'}>
          {state.kind === 'loading' ? 'Opening…' : 'Show my key'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function LostLicenseCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      <CardContent>
        <LostLicenseForm />
      </CardContent>
    </Card>
  );
}
