'use client';

import { Checkbox, Label, cn } from '@astrea/ui';
import type { Block } from '@/lib/beta-access/content';
import { RichText } from './rich-text';

// One consent, one unticked box, with its exact text (spec principle 2). The title, if any, is shown
// because it is hashed into the evidence. Boxes are required unless `optional`.
export function ConsentCheckbox({
  block,
  checked,
  onCheckedChange,
  error,
  optional,
  className,
}: {
  block: Block;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error?: string;
  optional?: boolean;
  className?: string;
}) {
  const id = `consent-${block.id}`;
  return (
    <div className={cn('flex items-start gap-3 py-3', className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        aria-required={optional ? undefined : true}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-relaxed">
          <span>
            {block.title && <span className="block font-medium">{block.title}</span>}
            <RichText text={block.text} />
          </span>
        </Label>
        {optional && <span className="text-xs text-muted-foreground">Optional</span>}
        {error && (
          <p id={`${id}-error`} className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
