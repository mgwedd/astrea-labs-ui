'use client';

import { Bot, Copy } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast,
} from '@astrea/ui';

/** The project's agent setup prompt, to copy into a coding agent. */
export function AgentSetupCard({ name, prompt }: { name: string; prompt: string }) {
  const copy = () =>
    navigator.clipboard.writeText(prompt).then(
      () => toast.success('Setup prompt copied'),
      () => toast.error('Couldn’t copy the prompt'),
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bot className="size-4 text-muted-foreground" /> Agent setup prompt
        </CardTitle>
        <CardDescription>Paste it into a coding agent to set up {name}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" onClick={copy}>
          <Copy /> Copy prompt
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              View
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Agent setup prompt</DialogTitle>
              <DialogDescription>{name}</DialogDescription>
            </DialogHeader>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-4 font-mono text-xs">
              {prompt}
            </pre>
            <Button onClick={copy}>
              <Copy /> Copy prompt
            </Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
