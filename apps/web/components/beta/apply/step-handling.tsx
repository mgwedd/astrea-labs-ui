'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@astrea/ui';
import { B0, DISCLOSURES, HANDLING, HANDLING_INTRO } from '@/lib/beta-access/content';
import { ConsentCheckbox } from '../consent-checkbox';
import { RichText } from '../rich-text';

export function StepHandling({
  consents,
  setConsent,
  errors,
}: {
  consents: Record<string, string>;
  setConsent: (id: string, ticked: boolean) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-pretty leading-relaxed">
          <RichText text={HANDLING_INTRO.text} />
        </p>
        <Accordion type="multiple" className="border-t">
          {HANDLING.map((block) => (
            <AccordionItem key={block.id} value={block.id}>
              <AccordionTrigger className="gap-4 text-left text-sm">{block.title}</AccordionTrigger>
              <AccordionContent className="text-pretty leading-relaxed text-muted-foreground">
                <RichText text={block.text} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <section aria-labelledby="disclosures-heading" className="flex flex-col gap-4">
        <h3 id="disclosures-heading" className="text-lg font-semibold tracking-tight">
          What you should know
        </h3>
        <ol className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
          {DISCLOSURES.map((block) => (
            <li key={block.id} className="text-pretty">
              <strong className="font-semibold text-foreground">
                {block.id}. {block.title}
              </strong>{' '}
              <RichText text={block.text} />
            </li>
          ))}
        </ol>
      </section>

      <ConsentCheckbox
        block={B0}
        checked={B0.id in consents}
        onCheckedChange={(v) => setConsent(B0.id, v)}
        error={errors[B0.id]}
      />
    </div>
  );
}
