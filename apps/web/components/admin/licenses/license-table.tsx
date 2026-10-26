import {
  Badge,
  Checkbox,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@astrea/ui';
import { reissueLicenseAction, revokeLicenseAction, sendKeyLinkAction } from '@/app/(admin)/admin/actions';
import { SubmitButton } from '@/components/admin/submit-button';
import { formatUtc, licenseState } from '@/lib/admin/format';
import type { License } from '@/lib/licensing/db/schema';
import { LicenseDialog } from './license-dialog';

const day = (d: Date | null) => (d ? formatUtc(d).slice(0, 10) : 'Never');

/** Rows of licenses with state, dates and a Manage dialog for active ones. */
export function LicenseTable({ rows, empty }: { rows: License[]; empty: string }) {
  if (rows.length === 0) return <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Holder</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Issued</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>License ID</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((l) => {
          const state = licenseState(l);
          return (
            <TableRow key={l.lid}>
              <TableCell className="break-all">{l.email}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant={state === 'active' ? 'default' : 'secondary'} className="self-start capitalize">
                    {state}
                  </Badge>
                  {l.revokedAt && (
                    <span className="max-w-60 whitespace-normal break-words text-xs text-muted-foreground">
                      {formatUtc(l.revokedAt)} by {l.revokedBy ?? 'unknown'}: {l.revokedReason}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">{day(l.issuedAt)}</TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">{day(l.expiresAt)}</TableCell>
              <TableCell className="break-all font-mono text-xs text-muted-foreground">{l.lid}</TableCell>
              <TableCell className="text-right">
                {state === 'active' && (
                  <LicenseDialog email={l.email}>
                    <LicenseActions license={l} />
                  </LicenseDialog>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function LicenseActions({ license: l }: { license: License }) {
  return (
    <div className="flex flex-col gap-4">
      <form action={sendKeyLinkAction}>
        <input type="hidden" name="lid" value={l.lid} />
        <input type="hidden" name="email" value={l.email} />
        <SubmitButton variant="outline" size="sm">
          Email a new key link
        </SubmitButton>
      </form>

      <Separator />

      <form action={reissueLicenseAction} className="flex flex-col gap-3">
        <input type="hidden" name="lid" value={l.lid} />
        <input type="hidden" name="email" value={l.email} />
        <Field orientation="horizontal">
          <Checkbox id={`revoke-old-${l.lid}`} name="revokeOld" />
          <FieldLabel htmlFor={`revoke-old-${l.lid}`}>Revoke this license when reissuing</FieldLabel>
        </Field>
        <Field>
          <FieldLabel htmlFor={`reissue-reason-${l.lid}`}>Reason (optional)</FieldLabel>
          <Input id={`reissue-reason-${l.lid}`} name="reason" maxLength={200} />
        </Field>
        <div>
          <SubmitButton variant="outline" size="sm">
            Reissue
          </SubmitButton>
        </div>
      </form>

      <Separator />

      <form action={revokeLicenseAction} className="flex flex-col gap-3">
        <input type="hidden" name="lid" value={l.lid} />
        <input type="hidden" name="email" value={l.email} />
        <Field>
          <FieldLabel htmlFor={`revoke-reason-${l.lid}`}>Revoke reason (required)</FieldLabel>
          <Input id={`revoke-reason-${l.lid}`} name="reason" required maxLength={200} />
          <FieldDescription>Also revokes any licenses that replaced this one. Recorded in the audit log.</FieldDescription>
        </Field>
        <div>
          <SubmitButton variant="destructive" size="sm">
            Revoke
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
