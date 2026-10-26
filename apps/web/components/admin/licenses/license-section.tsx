'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger, cn } from '@astrea/ui';

/** A collapsible board section with a count. Empty sections stay collapsed. */
export function LicenseSection({
  title,
  count,
  hint,
  defaultOpen,
  children,
}: {
  title: string;
  count: ReactNode;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border">
      <CollapsibleTrigger className="group flex w-full flex-wrap items-center gap-2 px-5 py-4 text-left hover:bg-muted/30">
        <ChevronRightIcon
          aria-hidden
          className={cn('size-4 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-90')}
        />
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
        {hint && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">{children}</CollapsibleContent>
    </Collapsible>
  );
}
