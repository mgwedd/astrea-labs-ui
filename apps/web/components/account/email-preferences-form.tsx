'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription, Checkbox, Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@astrea/ui';
import { saveEmailPreferences, type EmailPrefsState } from '@/app/(site)/account/email-actions';
import { SubmitButton } from '@/components/admin/submit-button';

export function EmailPreferencesForm({ product, news }: { product: boolean; news: boolean }) {
  const [state, action] = useActionState<EmailPrefsState, FormData>(saveEmailPreferences, null);
  return (
    <form action={action}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Email me about</FieldLegend>
          <FieldGroup className="gap-4">
            <Field orientation="horizontal">
              <Checkbox id="email-product" name="product" defaultChecked={product} />
              <FieldContent>
                <FieldLabel htmlFor="email-product">Apps I have installed or licensed</FieldLabel>
                <FieldDescription>Product emails, such as Aletheia updates.</FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="email-news" name="news" defaultChecked={news} />
              <FieldContent>
                <FieldLabel htmlFor="email-news">Lab news</FieldLabel>
                <FieldDescription>Blog posts and new products.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </FieldSet>
        {state ? (
          <Alert variant={state.ok ? 'default' : 'destructive'} role="status">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <div>
          <SubmitButton>Save</SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
