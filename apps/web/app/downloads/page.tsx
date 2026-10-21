import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Download } from 'lucide-react';
import { projects } from '@astrea/research-registry';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@astrea/ui';
import { PageHeader } from '@/components/page-header';
import { PLATFORM_LABEL } from '@/components/project-detail';
import { ProjectStatusBadge } from '@/components/project-status';
import { formatBytes, getLatestRelease } from '@/lib/releases';
import { formatDate } from '@/lib/writing';

export const revalidate = 3600;
export const metadata: Metadata = { title: 'Downloads', description: 'Desktop builds of Astrea Labs apps.' };

export default async function DownloadsPage() {
  const apps = projects.filter((p) => p.downloads?.length).sort((a, b) => a.order - b.order);
  const releases = await Promise.all(apps.map((p) => (p.releases ? getLatestRelease(p.releases) : null)));

  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Downloads" title="Get the apps" />
      <div className="grid gap-6 lg:grid-cols-2">
        {apps.map((p, i) => {
          const release = releases[i];
          return (
            <Card key={p.slug} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>
                    <Link href={`/projects/${p.slug}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </CardTitle>
                  <ProjectStatusBadge status={p.status} />
                </div>
                <CardDescription>{p.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {release && release.assets.length > 0
                  ? release.assets.map((a) => (
                      <a
                        key={a.name}
                        href={a.url}
                        className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/40"
                      >
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium">{a.platform && PLATFORM_LABEL[a.platform]}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {a.name} · {formatBytes(a.size)}
                          </span>
                        </span>
                        <Download className="size-4 text-muted-foreground" />
                      </a>
                    ))
                  : p.downloads!.map((d) => (
                      <a
                        key={d.url + d.platform}
                        href={d.url}
                        className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/40"
                      >
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium">{d.label}</span>
                          {d.note && <span className="text-xs text-muted-foreground">{d.note}</span>}
                        </span>
                        <ArrowUpRight className="size-4 text-muted-foreground" />
                      </a>
                    ))}
                {release && p.downloads?.some((d) => d.note) && (
                  <p className="text-xs text-muted-foreground">
                    {[...new Set(p.downloads.map((d) => d.note).filter(Boolean))].join(' · ')}
                  </p>
                )}
              </CardContent>
              {release && (
                <CardFooter className="justify-between text-sm text-muted-foreground">
                  <span className="font-mono text-xs">
                    {release.tag} · {formatDate(release.publishedAt.slice(0, 10))}
                  </span>
                  <Button variant="link" size="sm" className="px-0" asChild>
                    <a href={release.url} target="_blank" rel="noreferrer">
                      Release notes <ArrowUpRight />
                    </a>
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
