import { Badge, Card, CardHeader, CardTitle, Empty, Field, FieldLabel, Input, RadioGroup, RadioGroupItem } from '@astrea/ui';
import { createTestLicenseAction, revokeTestLicenseAction } from '@/app/(admin)/admin/actions';
import { formatUtc } from '@/lib/admin/format';
import type { TestLicense } from '@/lib/licensing/db/schema';
import { TEST_LICENSE_DAYS } from '@/lib/licensing/test-license';
import { SubmitButton } from './submit-button';
import { TestLicenseReveal } from './test-license-reveal';

/** The live test licenses, each revealable, and a form to add one. */
export function TestLicenses({ licenses }: { licenses: TestLicense[] }) {
  return (
    <div className="flex flex-col gap-4">
      {licenses.length === 0 && <Empty title="No test licenses" />}
      {licenses.map((l) => (
        <Card key={l.lid}>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="break-words text-base">{l.label}</CardTitle>
              <Badge variant={l.revokedAt ? 'secondary' : 'default'}>{l.revokedAt ? 'Revoked' : 'Live'}</Badge>
            </div>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Expires</dt>
              <dd>{formatUtc(l.expiresAt)}</dd>
              <dt className="text-muted-foreground">Issued</dt>
              <dd>
                {formatUtc(l.issuedAt)} by {l.createdBy}
              </dd>
              <dt className="text-muted-foreground">License id</dt>
              <dd className="break-all font-mono text-xs">{l.lid}</dd>
            </dl>
            {!l.revokedAt && (
              <div className="flex flex-col gap-3">
                <TestLicenseReveal lid={l.lid} />
                <form action={revokeTestLicenseAction}>
                  <input type="hidden" name="lid" value={l.lid} />
                  <SubmitButton variant="ghost" size="sm">
                    Revoke
                  </SubmitButton>
                </form>
              </div>
            )}
          </CardHeader>
        </Card>
      ))}

      <form action={createTestLicenseAction} className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="test-label">Label</FieldLabel>
          <Input id="test-label" name="label" required maxLength={60} placeholder="e.g. v2.64 smoke test" />
        </Field>
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
          <SubmitButton size="sm">Add test license</SubmitButton>
        </div>
      </form>
    </div>
  );
}
