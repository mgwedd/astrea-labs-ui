'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, cn } from '@astrea/ui';

/**
 * Secondary detail behind a small info icon. Opens on hover, keyboard focus and
 * tap (tooltips don't open on touch by themselves). The text also sits in an
 * sr-only span with `id`, so a control can point aria-describedby at it.
 */
export function InfoTip({
  id,
  label,
  children,
  className,
}: {
  id?: string;
  /** What the detail is about, for the button's accessible name. */
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`More about ${label}`}
            aria-describedby={id}
            // Hover and focus already open it; a click (or tap) keeps it open until blur or Escape.
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            className={cn(
              'inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
          >
            <Info className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" collisionPadding={16} className="max-w-xs text-pretty leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
      {id && (
        <span id={id} className="sr-only">
          {children}
        </span>
      )}
    </>
  );
}
