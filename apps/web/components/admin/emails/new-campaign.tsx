'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Collapsible, CollapsibleContent, CollapsibleTrigger } from '@astrea/ui';
import { CampaignComposer } from './campaign-composer';

type Option = { value: string; label: string };

/** The campaign composer, hidden until the admin asks for it. */
export function NewCampaign({ audiences }: { audiences: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-4">
      {!open && (
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="self-start">
            <Plus data-icon="inline-start" />
            New campaign
          </Button>
        </CollapsibleTrigger>
      )}
      <CollapsibleContent>
        <Card>
          <CardHeader>
            <CardTitle>New campaign</CardTitle>
            <CardDescription>Paste or upload HTML. Sent to everyone who opted in on their account, except addresses that bounced or complained.</CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignComposer audiences={audiences} onDiscard={() => setOpen(false)} />
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
