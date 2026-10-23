import { Label, cn } from '@astrea/ui';
import { InfoTip } from './info-tip';

/** Error styling for inputs marked aria-invalid (the kit's Input predates it). */
export const invalidClass = 'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive';

/** id, aria-invalid and aria-describedby for a control inside <Field>. `description` points at the hint behind the info icon. */
export function controlProps(id: string, opts: { error?: string; description?: boolean }) {
  const describedBy = [opts.description && `${id}-description`, opts.error && `${id}-error`].filter(Boolean).join(' ');
  return {
    id,
    'aria-invalid': opts.error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const;
}

export function Field({
  id,
  label,
  description,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: React.ReactNode;
  /** Secondary hint, shown behind an info icon next to the label. */
  description?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="leading-snug">
          {label}
          {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
        </Label>
        {description && (
          <InfoTip id={`${id}-description`} label={typeof label === 'string' ? label : 'this field'}>
            {description}
          </InfoTip>
        )}
      </div>
      {children}
      <FieldError id={id} error={error} />
    </div>
  );
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="text-sm font-medium text-destructive">
      {error}
    </p>
  );
}

/** A group of related controls (checkbox lists, repeatable rows). */
export function FieldSet({
  id,
  legend,
  description,
  error,
  optional,
  children,
}: {
  id: string;
  legend: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const describedBy = [description && `${id}-description`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <fieldset id={id} tabIndex={-1} aria-describedby={describedBy || undefined} className="flex flex-col gap-3 outline-none">
      <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium leading-snug">
        <span>
          {legend}
          {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
        </span>
        {description && (
          <InfoTip label={typeof legend === 'string' ? legend : 'this question'}>{description}</InfoTip>
        )}
      </legend>
      {description && (
        <span id={`${id}-description`} className="sr-only">
          {description}
        </span>
      )}
      {children}
      <FieldError id={id} error={error} />
    </fieldset>
  );
}
