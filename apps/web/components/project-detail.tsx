import Link from 'next/link';
import { ArrowUpRight, BookOpen, Check, Download, Globe, Lock } from 'lucide-react';
import { getDomain, technicalNotes, type Platform, type Project } from '@astrea/research-registry';
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@astrea/ui';
import { agentSetupPrompt } from '@/lib/agent-prompt';
import { getLatestRelease, formatBytes } from '@/lib/releases';
import { formatDate } from '@/lib/writing';
import { AgentSetupCard } from './agent-setup-card';
import { GitHubMark } from './logo';
import { Media } from './media/media';
import { PageActions } from './page-actions';
import { ProjectStatusBadge } from './project-status';

export const PLATFORM_LABEL: Record<Platform, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  ios: 'iOS',
  web: 'Web',
};

export async function ProjectDetail({ project }: { project: Project }) {
  const release = project.releases ? await getLatestRelease(project.releases) : null;
  const notes = technicalNotes.filter((n) => n.projectSlug === project.slug);
  const repoUrl = project.repo && !project.repo.private && `https://github.com/${project.repo.owner}/${project.repo.name}`;
  const primaryDownload = project.downloads?.[0];

  return (
    <div className="container">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/projects">Projects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{project.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageActions path={`/projects/${project.slug}`} />
      </div>

      <header className="flex flex-col gap-4 pb-10 pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
          {project.domains.map((d) => (
            <Badge key={d} variant="outline" className="font-normal">
              {getDomain(d).label}
            </Badge>
          ))}
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{project.name}</h1>
        <p className="max-w-2xl text-pretty text-xl text-muted-foreground">{project.tagline}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          {primaryDownload && (
            <Button asChild>
              <Link href="/downloads">
                <Download /> Download
                {release && <span className="font-mono text-xs opacity-70">{release.tag}</span>}
              </Link>
            </Button>
          )}
          {project.links.site && (
            <Button variant={primaryDownload ? 'outline' : 'default'} asChild>
              <a href={project.links.site} target="_blank" rel="noreferrer">
                <Globe /> Open {new URL(project.links.site).host}
              </a>
            </Button>
          )}
          {repoUrl && (
            <Button variant="outline" asChild>
              <a href={repoUrl} target="_blank" rel="noreferrer">
                <GitHubMark /> Source
              </a>
            </Button>
          )}
          {project.links.docs && (
            <Button variant="ghost" asChild>
              <a href={project.links.docs} target="_blank" rel="noreferrer">
                <BookOpen /> Docs
              </a>
            </Button>
          )}
        </div>
      </header>

      {project.media && project.media.length > 0 && (
        <section aria-label="Media" className="pb-12">
          <Media {...project.media[0]} priority className="my-0" />
          {project.media.length > 1 && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {project.media.slice(1).map((m) => (
                <Media key={m.src} {...m} className="my-0" />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {release && <TabsTrigger value="release">Latest release</TabsTrigger>}
            {notes.length > 0 && <TabsTrigger value="notes">Design notes</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="prose prose-neutral max-w-none dark:prose-invert">
              {project.description.map((p) => (
                <p key={p.slice(0, 32)}>{p}</p>
              ))}
            </div>
            <h2 className="mb-4 mt-10 text-lg font-semibold">Highlights</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {project.highlights.map((h) => (
                <li key={h} className="flex gap-3 rounded-lg border p-4 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {h}
                </li>
              ))}
            </ul>
          </TabsContent>

          {release && (
            <TabsContent value="release" className="mt-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{release.name}</h2>
                <span className="text-sm text-muted-foreground">
                  Published {formatDate(release.publishedAt.slice(0, 10))}
                </span>
              </div>
              {release.assets.length > 0 ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {release.assets.map((a) => (
                        <TableRow key={a.name}>
                          <TableCell className="font-mono text-xs">
                            <a href={a.url} className="hover:underline">
                              {a.name}
                            </a>
                          </TableCell>
                          <TableCell>{a.platform && PLATFORM_LABEL[a.platform]}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatBytes(a.size)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This release has no desktop builds attached.</p>
              )}
              <Button variant="link" className="mt-2 px-0" asChild>
                <a href={release.url} target="_blank" rel="noreferrer">
                  Release notes on GitHub <ArrowUpRight />
                </a>
              </Button>
            </TabsContent>
          )}

          {notes.length > 0 && (
            <TabsContent value="notes" className="mt-6 flex flex-col gap-3">
              {notes.map((n) => (
                <a
                  key={n.url}
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/40"
                >
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{n.title}</span>
                    <span className="text-sm text-muted-foreground">{n.summary}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </TabsContent>
          )}
        </Tabs>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Fact label="Started">{project.year}</Fact>
              {project.platforms && (
                <Fact label="Platforms">{project.platforms.map((p) => PLATFORM_LABEL[p]).join(', ')}</Fact>
              )}
              {project.license && <Fact label="License">{project.license}</Fact>}
              {project.subdomain && (
                <Fact label="Home">
                  <span className="font-mono text-xs">{project.subdomain}.astrealabs.com</span>
                </Fact>
              )}
              {project.repo?.private && (
                <Fact label="Source">
                  <span className="inline-flex items-center gap-1">
                    <Lock className="size-3" /> Private
                  </span>
                </Fact>
              )}
              <Separator />
              <div className="flex flex-wrap gap-1.5">
                {project.stack.map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
              {project.role && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">{project.role}</p>
                </>
              )}
            </CardContent>
          </Card>
          <AgentSetupCard name={project.name} prompt={agentSetupPrompt(project)} />
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
