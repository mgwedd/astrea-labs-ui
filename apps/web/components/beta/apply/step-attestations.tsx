'use client';

import { OPTIONAL_AT_APPLY, REQUIRED_AT_APPLY, blockById } from '@/lib/beta-access/content';
import { ConsentCheckbox } from '../consent-checkbox';

export function StepAttestations({
  legalVersion,
  consents,
  setConsent,
  errors,
}: {
  legalVersion: string;
  consents: Record<string, string>;
  setConsent: (id: string, ticked: boolean) => void;
  errors: Record<string, string>;
}) {
  const REQUIRED = REQUIRED_AT_APPLY.filter((id) => id.startsWith('C')).map((id) => blockById(id, legalVersion));
  const OPTIONAL = OPTIONAL_AT_APPLY.map((id) => blockById(id, legalVersion));
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Each statement is required. If you can&apos;t agree to one of them, you can&apos;t apply for the beta.
      </p>
      <div className="flex flex-col divide-y">
        {REQUIRED.map((block) => (
          <ConsentCheckbox
            key={block.id}
            block={block}
            checked={block.id in consents}
            onCheckedChange={(v) => setConsent(block.id, v)}
            error={errors[block.id]}
          />
        ))}
      </div>
      <div className="flex flex-col border-t pt-3">
        {OPTIONAL.map((block) => (
          <ConsentCheckbox
            key={block.id}
            block={block}
            optional
            checked={block.id in consents}
            onCheckedChange={(v) => setConsent(block.id, v)}
          />
        ))}
      </div>
    </div>
  );
}
