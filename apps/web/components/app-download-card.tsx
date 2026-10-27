import Link from 'next/link';
import { ArrowUpRight, Download } from 'lucide-react';
import type { Project } from '@astrea/research-registry';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@astrea/ui';
import { PLATFORM_LABEL } from '@/components/project-detail';
import { ProjectStatusBadge } from '@/components/project-status';
import { formatBytes, type Release } from '@/lib/releases';
import { formatDate } from '@/lib/writing';

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
              <Item key={a.name} variant="outline" asChild>
                <a href={a.url}>
                  <ItemContent className="gap-0.5">
                    <ItemTitle>{a.platform && PLATFORM_LABEL[a.platform]}</ItemTitle>
                    <ItemDescription className="line-clamp-none break-all font-mono text-xs">
                      {a.name} · {formatBytes(a.size)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="text-muted-foreground">
                    <Download className="size-4" />
                  </ItemActions>
                </a>
              </Item>
            ))
          : p.downloads!.map((d) => (
              <Item key={d.url + d.platform} variant="outline" asChild>
                <a href={d.url}>
                  <ItemContent className="gap-0.5">
                    <ItemTitle>{d.label}</ItemTitle>
                    {d.note && <ItemDescription className="line-clamp-none text-xs">{d.note}</ItemDescription>}
                  </ItemContent>
                  <ItemActions className="text-muted-foreground">
                    <ArrowUpRight className="size-4" />
                  </ItemActions>
                </a>
              </Item>
            ))}
        {release && p.downloads?.some((d) => d.note) && (
          <p className="text-xs text-muted-foreground">
            {[...new Set(p.downloads.map((d) => d.note).filter(Boolean))].join(' · ')}
          </p>
        )}
        {p.slug === 'aletheia' && (
          <p className="text-sm text-muted-foreground">
            Aletheia needs a free beta license key before first use.{' '}
            <Link href="/aletheia/beta" className="underline underline-offset-4 hover:text-foreground">
              Apply for a free beta license
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
