'use client';

import { HoverCard, HoverCardContent, HoverCardTrigger, Badge, cn } from '@astrea/ui';
import type { AuthorView } from '@/lib/forum/service';

/**
 * A member's name as posted. Admins get a hover card with the real account behind it (the service
 * only sets `author.account` for admin viewers, so members never see it).
 */
export function AuthorName({ author, className }: { author: AuthorView; className?: string }) {
  const name = (
    <span className={cn('font-medium', className)}>
      {author.name}
    </span>
  );
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {author.account ? (
        <HoverCard openDelay={150}>
          <HoverCardTrigger asChild>
            <button type="button" className="cursor-help rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {name}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-72 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account (admins only)</p>
            <p className="mt-1 break-all">{author.account.email || 'No email on file'}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{author.account.sub}</p>
            <p className="mt-2 text-xs text-muted-foreground">Posting as {author.mode === 'handle' ? 'a random handle' : 'their username'}.</p>
          </HoverCardContent>
        </HoverCard>
      ) : (
        name
      )}
      {author.isStaff && <Badge variant="secondary">Staff</Badge>}
    </span>
  );
}
