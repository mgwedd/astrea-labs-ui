import { ExternalLink, FileText } from 'lucide-react';
import { Button } from '@astrea/ui';

// The exact PDF the applicant signs (spec D2.1: show that rendering, not an
// HTML copy). Mobile browsers render inline PDFs poorly, so there's always a link.
export function DocumentFrame({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <iframe
        src="/api/beta/document"
        title={title}
        className="h-[60vh] min-h-[420px] w-full rounded-lg border bg-muted md:h-[75vh]"
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="outline" size="sm" asChild>
          <a href="/api/beta/document" target="_blank" rel="noopener noreferrer">
            <FileText data-icon="inline-start" />
            Open PDF
            <ExternalLink data-icon="inline-end" />
          </a>
        </Button>
        <span className="text-xs text-muted-foreground md:hidden">On a phone, open the PDF to read every page.</span>
      </div>
    </div>
  );
}
