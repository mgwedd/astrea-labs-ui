'use client';

import { useState } from 'react';
import { AppWindow, Copy, Eye } from 'lucide-react';
import { Button, Label, Textarea, toast } from '@astrea/ui';
import { revealTestLicenseAction } from '@/app/(admin)/admin/actions';

const openInAppUrl = (key: string) => `aletheia://license?key=${encodeURIComponent(key)}`;

/** Fetches a test license's key on demand and shows it with Open and Copy buttons. */
export function TestLicenseReveal({ lid }: { lid: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    const form = new FormData();
    form.set('lid', lid);
    try {
      const r = await revealTestLicenseAction(form);
      if (r) setToken(r.token);
      else toast.error('That test license is no longer live. Reload the page.');
    } catch {
      toast.error('Couldn’t load the key. Try again.');
    } finally {
      setBusy(false);
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

  if (!token) {
    return (
      <Button variant="outline" size="sm" onClick={reveal} disabled={busy}>
        <Eye data-icon="inline-start" />
        Reveal key
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor={`key-${lid}`} className="sr-only">
        License key
      </Label>
      <Textarea
        id={`key-${lid}`}
        value={token}
        readOnly
        rows={4}
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        className="resize-none break-all font-mono text-xs"
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild size="sm">
          <a href={openInAppUrl(token)}>
            <AppWindow data-icon="inline-start" />
            Open in Aletheia
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => copy(token)}>
          <Copy data-icon="inline-start" />
          Copy key
        </Button>
      </div>
    </div>
  );
}
