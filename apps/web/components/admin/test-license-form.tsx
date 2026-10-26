'use client';

import { useActionState } from 'react';
import { AppWindow, Copy } from 'lucide-react';
import { Button, Field, FieldLabel, Label, RadioGroup, RadioGroupItem, Textarea, toast } from '@astrea/ui';
import { issueTestLicenseAction, type TestLicenseState } from '@/app/(admin)/admin/licenses/test-license-actions';
import { SubmitButton } from './submit-button';
import { formatUtc } from '@/lib/admin/format';
import { TEST_LICENSE_DAYS } from '@/lib/licensing/test-license';

const openInAppUrl = (key: string) => `aletheia://license?key=${encodeURIComponent(key)}`;

export function TestLicenseForm() {
  const [state, action] = useActionState<TestLicenseState, FormData>(issueTestLicenseAction, null);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Key copied');
    } catch {
      toast.error('Couldn’t copy. Select the key and copy it by hand.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        <Field>
          <FieldLabel>Lasts</FieldLabel>
          <RadioGroup name="days" defaultValue="7" className="flex flex-wrap gap-4">
            {TEST_LICENSE_DAYS.map((d) => (
              <Field key={d} orientation="horizontal" className="w-auto">
                <RadioGroupItem id={`test-days-${d}`} value={String(d)} />
                <FieldLabel htmlFor={`test-days-${d}`}>
                  {d} {d === 1 ? 'day' : 'days'}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </Field>
        <div>
          <SubmitButton size="sm">Issue test license</SubmitButton>
        </div>
      </form>

      {state && !state.ok && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      {state?.ok && (
        <div className="flex flex-col gap-3">
          <Label htmlFor="test-license-key">Key, valid until {formatUtc(new Date(state.expiresAt))}</Label>
          <Textarea
            id="test-license-key"
            value={state.token}
            readOnly
            rows={4}
            spellCheck={false}
            onFocus={(e) => e.currentTarget.select()}
            className="resize-none break-all font-mono text-xs"
          />
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm">
              <a href={openInAppUrl(state.token)}>
                <AppWindow data-icon="inline-start" />
                Open in Aletheia
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(state.token)}>
              <Copy data-icon="inline-start" />
              Copy key
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Shown once and not saved. It can’t be revoked; it runs out on its own.</p>
        </div>
      )}
    </div>
  );
}
