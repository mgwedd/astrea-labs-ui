import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getDomain, type Project } from '@astrea/research-registry';
import { Badge, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cn } from '@astrea/ui';
import { ProjectStatusBadge } from './project-status';

export function ProjectCard({ project, className }: { project: Project; className?: string }) {
  return (
    <Card
      className={cn(
        'group relative flex flex-col transition-colors hover:border-foreground/20 hover:bg-muted/30',
        className
      )}
    >
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{getDomain(project.domains[0]).label}</span>
          <ProjectStatusBadge status={project.status} />
        </div>
        <CardTitle className="flex items-center gap-1 text-xl">
          <Link href={`/projects/${project.slug}`} className="after:absolute after:inset-0">
            {project.name}
          </Link>
          <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </CardTitle>
        <CardDescription className="text-pretty">{project.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 text-sm text-muted-foreground">{project.summary}</CardContent>
      <CardFooter className="flex flex-wrap gap-1.5">
        {project.stack.slice(0, 4).map((s) => (
          <Badge key={s} variant="outline" className="font-normal">
            {s}
          </Badge>
        ))}
      </CardFooter>
    </Card>
  );
}
