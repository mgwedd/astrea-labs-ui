import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { Button } from '@astrea/ui';

/** Stands in for a composer until the member has confirmed their username. */
export function ConfirmGate({ username }: { username: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <UserRound className="size-4" aria-hidden />
        Confirm your username to post
      </p>
      <p className="text-muted-foreground">
        You will post as {username} unless you change it. Your default came from your email address.
      </p>
      <Button asChild size="sm">
        <Link href="/forum/settings">Confirm username</Link>
      </Button>
    </div>
  );
}
