import type { Metadata } from 'next';
import Link from 'next/link';
import { DOMAINS, projects } from '@astrea/research-registry';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@astrea/ui';
import { GitHubMark } from '@/components/logo';
import { PageActions } from '@/components/page-actions';
import { PageHeader } from '@/components/page-header';
import { markdownAlternates } from '@/lib/markdown-route';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'About', description: site.description, alternates: markdownAlternates('/about') };

export default function AboutPage() {
  return (
    <div className="container max-w-3xl pb-16">
      <PageHeader eyebrow="About" title={site.about.title} actions={<PageActions path="/about" />}>
        {site.about.intro}
      </PageHeader>

      <div className="prose prose-neutral max-w-none dark:prose-invert">
        <p>{site.about.body}</p>
      </div>

      <Separator className="my-12" />

      <h2 className="mb-6 text-xl font-semibold tracking-tight">People</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {site.team.map((m) => (
          <a key={m.github} href={`https://github.com/${m.github}`} target="_blank" rel="noreferrer" className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <Avatar className="size-12">
                  <AvatarImage src={`https://github.com/${m.github}.png?size=96`} alt="" />
                  <AvatarFallback>
                    {m.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  <CardDescription className="inline-flex items-center gap-1.5 font-mono text-xs">
                    <GitHubMark className="size-3" /> {m.github}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </a>
        ))}
      </div>

      <Separator className="my-12" />

      <h2 className="mb-6 text-xl font-semibold tracking-tight">What we work on</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {DOMAINS.map((d) => (
          <Link key={d.id} href={`/projects?domain=${d.id}`} className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between text-base">
                  {d.label}
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {projects.filter((p) => p.domains.includes(d.id)).length}
                  </span>
                </CardTitle>
                <CardDescription>{d.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Separator className="my-12" />

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/projects">See the projects</Link>
        </Button>
        <Button variant="outline" asChild>
          <a href={site.github} target="_blank" rel="noreferrer">
            <GitHubMark /> GitHub
          </a>
        </Button>
      </div>
    </div>
  );
}
