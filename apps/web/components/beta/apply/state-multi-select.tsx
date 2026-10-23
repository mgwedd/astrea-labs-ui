'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@astrea/ui';
import { US_STATES } from '@/lib/beta-access/answers';

const labelOf = (code: string) => US_STATES.find((s) => s.value === code)?.label ?? code;

export function StateMultiSelect({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((v) => v !== code) : [...value, code]);
  // Keep chips in alphabetical order, whatever order they were picked in.
  const selected = US_STATES.filter((s) => value.includes(s.value));

  return (
    <div className="flex flex-col gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              'w-full justify-between font-normal',
              selected.length === 0 && 'text-muted-foreground',
              invalid && 'border-destructive',
            )}
          >
            {selected.length === 0
              ? 'Choose states'
              : `${selected.length} ${selected.length === 1 ? 'state' : 'states'} selected`}
            <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Search states…" />
            <CommandList>
              <CommandEmpty>No state found.</CommandEmpty>
              <CommandGroup>
                {US_STATES.map((s) => {
                  const isSelected = value.includes(s.value);
                  return (
                    <CommandItem key={s.value} value={s.label} keywords={[s.value]} onSelect={() => toggle(s.value)}>
                      <Check className={cn(isSelected ? 'opacity-100' : 'opacity-0')} aria-hidden />
                      {s.label}
                      {isSelected && <span className="sr-only">, selected</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <ul aria-label="Selected states" className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <li key={s.value}>
              <Badge variant="secondary" className="gap-1 py-1 pl-2.5 pr-1 font-medium">
                {s.label}
                <button
                  type="button"
                  onClick={() => toggle(s.value)}
                  aria-label={`Remove ${labelOf(s.value)}`}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
