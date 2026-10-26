'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Button } from '@astrea/ui';

/** Shown to members who have not confirmed their username. Hidden on the settings page, which is where they do it. */
export function ConfirmBanner({ username }: { username: string }) {
  const pathname = usePathname();
  if (pathname === '/forum/settings') return null;
  return (
    <Alert className="mb-6">
      <UserRound className="size-4" aria-hidden />
      <AlertTitle>Confirm your username</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          You will post as <strong className="font-medium text-foreground">{username}</strong> unless you change it. Confirm it before your first post.
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href="/forum/settings">Confirm username</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
