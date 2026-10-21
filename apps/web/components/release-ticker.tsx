import Link from 'next/link';
import { projects } from '@astrea/research-registry';
import { Card, CardContent, CardHeader, CardTitle, Separator } from '@astrea/ui';
import { getLatestRelease } from '@/lib/releases';
import { formatDate } from '@/lib/writing';

/** Latest tagged release of every project that publishes them. */
export async function ReleaseTicker() {
  const withRepo = projects.filter((p) => p.repo && !p.repo.private);
  const releases = (
    await Promise.all(withRepo.map(async (p) => ({ project: p, release: await getLatestRelease(p.repo!) })))
  )
    .filter((r) => r.release)
    .sort((a, b) => b.release!.publishedAt.localeCompare(a.release!.publishedAt));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping motion-reduce:animate-none rounded-full bg-primary opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Latest releases
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col text-sm">
        {releases.length === 0 && (
          <p className="text-muted-foreground">Release feed unavailable right now — see each project on GitHub.</p>
        )}
        {releases.map(({ project, release }, i) => (
          <div key={project.slug}>
            {i > 0 && <Separator className="my-3" />}
            <Link href={`/projects/${project.slug}`} className="flex items-baseline justify-between gap-3 hover:underline">
              <span className="font-medium">{project.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{release!.tag}</span>
            </Link>
            <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(release!.publishedAt.slice(0, 10))}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
