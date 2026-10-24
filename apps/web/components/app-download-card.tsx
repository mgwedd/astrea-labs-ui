import Link from 'next/link';
import { ArrowUpRight, Download } from 'lucide-react';
import type { Project } from '@astrea/research-registry';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@astrea/ui';
import { PLATFORM_LABEL } from '@/components/project-detail';
import { ProjectStatusBadge } from '@/components/project-status';
import { formatBytes, type Release } from '@/lib/releases';
import { formatDate } from '@/lib/writing';

const rowClass = 'flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/40';

/** Download card for one app: latest release assets, or the registry links when there is no release. */
export function AppDownloadCard({ project: p, release }: { project: Project; release: Release | null }) {
  return (
    <Card className="flex flex-col">
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
              <a key={a.name} href={a.url} className={rowClass}>
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
              <a key={d.url + d.platform} href={d.url} className={rowClass}>
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
        {p.slug === 'aletheia' && (
          <p className="text-sm text-muted-foreground">
            Aletheia needs a free beta license.{' '}
            <Link href="/aletheia/beta" className="underline underline-offset-4 hover:text-foreground">
              Get one by email
            </Link>
            .
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
}
