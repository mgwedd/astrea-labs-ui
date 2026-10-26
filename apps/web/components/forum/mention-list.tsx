'use client';

import { cn } from '@astrea/ui';
import type { Mentionable } from '@/lib/forum/service';

/** The @mention suggestion list. Mouse-down does not steal focus from the editor. */
export function MentionList({
  items,
  index,
  onPick,
  className,
}: {
  items: Mentionable[];
  index: number;
  onPick: (m: Mentionable) => void;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul role="listbox" aria-label="Mention a member" className={cn('z-30 w-56 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md', className)}>
      {items.map((m, i) => (
        <li
          key={m.name}
          role="option"
          aria-selected={i === index}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(m);
          }}
          className={cn('flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm', i === index && 'bg-accent text-accent-foreground')}
        >
          <span className="truncate">@{m.name}</span>
          {m.mode === 'handle' && <span className="text-xs text-muted-foreground">handle</span>}
        </li>
      ))}
    </ul>
  );
}
