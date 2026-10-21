'use client';

import { Copy, Quote } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast,
} from '@astrea/ui';

export function CiteButton({ title, bibtex }: { title: string; bibtex: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Quote /> Cite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cite this paper</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-4 font-mono text-xs">{bibtex}</pre>
        <Button
          onClick={() => navigator.clipboard.writeText(bibtex).then(() => toast.success('BibTeX copied'))}
        >
          <Copy /> Copy BibTeX
        </Button>
      </DialogContent>
    </Dialog>
  );
}
