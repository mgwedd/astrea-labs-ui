import Link from 'next/link';
import { ArrowRight, ArrowUpRight, GitMerge } from 'lucide-react';
import { contributions, DOMAINS, featuredProjects, projects } from '@astrea/research-registry';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Separator } from '@astrea/ui';
import { ProjectCard } from '@/components/project-card';
import { ReleaseTicker } from '@/components/release-ticker';
import { SectionHeading } from '@/components/page-header';
import { formatDate, getPosts } from '@/lib/writing';

export const revalidate = 3600;

export default function HomePage() {
  const featured = featuredProjects();
  const posts = getPosts().slice(0, 3);
  const merged = contributions.filter((c) => c.state === 'merged');

  return (
    <div className="container">
      <section className="grid gap-10 pb-16 pt-14 md:grid-cols-[1fr_18rem] md:pt-20 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col items-start gap-6">
          <Link
            href="/projects/aletheia"
            className="group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Badge className="rounded-full px-2 py-0">New</Badge>
            Aletheia is in public beta
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <h1 className="max-w-2xl text-balance text-4xl font-extrabold tracking-tight md:text-5xl">
            AI research lab focused on embedded systems.
          </h1>
          <p className="max-w-xl text-pretty text-lg text-muted-foreground">
            Astrea Labs builds tools that run on your own hardware and keep your data there.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/projects">Browse projects</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/downloads">Downloads</Link>
            </Button>
          </div>
        </div>
        <ReleaseTicker />
      </section>

      <section>
        <SectionHeading
          title="Selected work"
          action={
            <Button variant="link" className="px-0" asChild>
              <Link href="/projects">
                All {projects.length} projects <ArrowRight />
              </Link>
            </Button>
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          {featured.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </section>

      <Separator className="my-16" />

      <section className="grid gap-12 lg:grid-cols-2">
        <div>
          <SectionHeading
            title="Writing"
            action={
              <Button variant="link" className="px-0" asChild>
                <Link href="/writing">
                  All writing <ArrowRight />
                </Link>
              </Button>
            }
          />
          <ul className="flex flex-col">
            {posts.map((post, i) => (
              <li key={post.slug}>
                {i > 0 && <Separator />}
                <Link href={`/writing/${post.slug}`} className="group flex flex-col gap-1 py-4">
                  <span className="font-mono text-xs text-muted-foreground">{formatDate(post.date)}</span>
                  <span className="font-medium group-hover:underline">{post.title}</span>
                  <span className="text-sm text-muted-foreground">{post.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionHeading
            title="Upstream"
            action={
              <Button variant="link" className="px-0" asChild>
                <Link href="/research#upstream">
                  All contributions <ArrowRight />
                </Link>
              </Button>
            }
          />
          <ul className="flex flex-col">
            {merged.map((c, i) => (
              <li key={c.url}>
                {i > 0 && <Separator />}
                <a href={c.url} target="_blank" rel="noreferrer" className="group flex items-start gap-3 py-4">
                  <GitMerge className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium group-hover:underline">{c.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.project} #{c.url.split('/').pop()}
                    </span>
                  </span>
                  <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Separator className="my-16" />

      <section>
        <SectionHeading title="What we work on" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DOMAINS.map((d) => {
            const count = projects.filter((p) => p.domains.includes(d.id)).length;
            return (
              <Link key={d.id} href={`/projects?domain=${d.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-muted/30">
                  <CardHeader>
                    <CardTitle className="flex items-baseline justify-between text-base">
                      {d.label}
                      <span className="font-mono text-xs font-normal text-muted-foreground">{count}</span>
                    </CardTitle>
                    <CardDescription>{d.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
