'use client';

import { Pencil } from 'lucide-react';
import { Button, Separator } from '@astrea/ui';
import { describeAnswers, type Answers } from '@/lib/beta-access/answers';
import { REQUIRED_AT_APPLY } from '@/lib/beta-access/content';
import { InfoTip } from '../info-tip';

function Section({
  title,
  info,
  onEdit,
  children,
}: {
  title: string;
  info: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <InfoTip label={title}>{info}</InfoTip>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil data-icon="inline-start" />
          Edit
        </Button>
      </div>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: { id: string; label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col divide-y text-sm">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="whitespace-pre-wrap break-words">{row.value || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StepReview({
  answers,
  consents,
  goTo,
}: {
  answers: Answers;
  consents: Record<string, string>;
  goTo: (step: number) => void;
}) {
  const attestations = REQUIRED_AT_APPLY.filter((id) => id.startsWith('C'));
  const ticked = attestations.filter((id) => id in consents).length;

  return (
    <div className="flex flex-col gap-6">
      <Section title="About you" info="These answers go into the document you’ll sign." onEdit={() => goTo(0)}>
        <Rows rows={describeAnswers(answers)} />
      </Section>

      <Separator />

      <Section
        title="What you’ve agreed to"
        info="Each tick is recorded with the exact text and the time you ticked it."
        onEdit={() => goTo(2)}
      >
        <Rows
          rows={[
            { id: 'B0', label: 'Patient information and disclosures', value: 'B0' in consents ? 'Read (B0)' : 'Not ticked' },
            { id: 'C', label: 'Attestations', value: `${ticked} of ${attestations.length} ticked (C1–C10)` },
            { id: 'C11', label: 'Release emails', value: 'C11' in consents ? 'Yes' : 'No' },
          ]}
        />
      </Section>

      <Separator />

      <p className="text-sm text-muted-foreground">
        Next, we email a link to <span className="font-medium text-foreground">{answers.email}</span> so you can sign.
        Your application counts only once you&apos;ve signed, and a key is issued only if it&apos;s approved.
      </p>
    </div>
  );
}
