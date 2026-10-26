'use client';

import type { ReactNode } from 'react';
import { SettingsIcon } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@astrea/ui';

/** Opens a license's actions (key link, reissue, revoke). The forms come in as server-rendered children. */
export function LicenseDialog({ email, children }: { email: string; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SettingsIcon data-icon="inline-start" />
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage license</DialogTitle>
          <DialogDescription className="break-all">{email}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
