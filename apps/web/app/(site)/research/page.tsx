import type { Metadata } from 'next';
import { ArrowUpRight, FileText, GitMerge, GitPullRequest } from 'lucide-react';
import { contributions, getProject, PUBLICATIONS, technicalNotes } from '@astrea/research-registry';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Empty, Separator } from '@astrea/ui';
import { CiteButton } from '@/components/cite-button';
import { PageHeader, SectionHeading } from '@/components/page-header';
import { formatDate } from '@/lib/writing';

export const metadata: Metadata = {
  title: 'Research',
  description: 'Papers, design documents and upstream contributions from Astrea Labs.',
};

export default function ResearchPage() {
  const sortedContribs = [...contributions].sort((a, b) =>
    a.state === b.state ? (b.date ?? '').localeCompare(a.date ?? '') : a.state === 'merged' ? -1 : 1,
  );

  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Research" title="Papers, notes and upstream work" />

      <section id="papers" className="scroll-mt-24">
        <SectionHeading title="Papers" />
        {PUBLICATIONS.length === 0 ? (
          <Empty
            icon={FileText}
            title="No papers yet"
            description="Formal write-ups will be listed here with PDFs and BibTeX. Until then, the design notes below are the deepest technical material we publish."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {PUBLICATIONS.map((p) => (
              <Card key={p.slug}>
                <CardHeader>
                  <CardDescription className="font-mono text-xs">
                    {p.venue} · {formatDate(p.date)}
                  </CardDescription>
                  <CardTitle>{p.title}</CardTitle>
                  <CardDescription>{p.authors.join(', ')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">{p.abstract}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.pdfUrl && (
                      <Button size="sm" asChild>
                        <a href={p.pdfUrl}>PDF</a>
                      </Button>
                    )}
                    {p.arxivId && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`https://arxiv.org/abs/${p.arxivId}`}>arXiv</a>
                      </Button>
                    )}
                    {p.bibtex && <CiteButton title={p.title} bibtex={p.bibtex} />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator className="my-16" />

      <section id="notes" className="scroll-mt-24">
        <SectionHeading title="Design notes" />
        <div className="grid gap-4 md:grid-cols-2">
          {technicalNotes.map((n) => {
            const project = getProject(n.projectSlug);
            return (
              <a key={n.url} href={n.url} target="_blank" rel="noreferrer" className="group">
                <Card className="h-full transition-colors group-hover:bg-muted/40">
                  <CardHeader>
                    <CardDescription className="flex items-center justify-between">
                      {project?.name}
                      <ArrowUpRight className="size-4" />
                    </CardDescription>
                    <CardTitle className="text-base">{n.title}</CardTitle>
                    <CardDescription>{n.summary}</CardDescription>
                  </CardHeader>
                </Card>
              </a>
            );
          })}
        </div>
      </section>

      <Separator className="my-16" />

      <section id="upstream" className="scroll-mt-24">
        <SectionHeading title="Upstream contributions" />
        <div className="rounded-lg border">
          {sortedContribs.map((c, i) => {
            const Icon = c.state === 'merged' ? GitMerge : GitPullRequest;
            return (
              <div key={c.url}>
                {i > 0 && <Separator />}
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-3 p-4 transition-colors hover:bg-muted/40"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium group-hover:underline">{c.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.project} #{c.url.split('/').pop()}
                      {c.date && ` · ${formatDate(c.date)}`}
                    </span>
                  </span>
                  <Badge variant={c.state === 'merged' ? 'secondary' : 'outline'} className="font-normal">
                    {c.state === 'merged' ? 'Merged' : 'Open'}
                  </Badge>
                </a>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
