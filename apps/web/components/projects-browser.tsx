'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DOMAINS, type Domain, type Project } from '@astrea/research-registry';
import { Empty, ToggleGroup, ToggleGroupItem } from '@astrea/ui';
import { FolderSearch } from 'lucide-react';
import { ProjectCard } from './project-card';

export function ProjectsBrowser({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get('domain');
  const domain = DOMAINS.some((d) => d.id === raw) ? (raw as Domain) : 'all';

  const setDomain = (value: string) => {
    const next = !value || value === 'all' ? pathname : `${pathname}?domain=${value}`;
    router.replace(next, { scroll: false });
  };

  const visible = domain === 'all' ? projects : projects.filter((p) => p.domains.includes(domain));

  return (
    <div className="flex flex-col gap-6">
      <ToggleGroup
        type="single"
        value={domain}
        onValueChange={setDomain}
        variant="outline"
        className="flex-wrap justify-start"
        aria-label="Filter by domain"
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        {DOMAINS.map((d) => (
          <ToggleGroupItem key={d.id} value={d.id}>
            {d.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {visible.length === 0 ? (
        <Empty icon={FolderSearch} title="Nothing here yet" description="No projects in this domain right now." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
