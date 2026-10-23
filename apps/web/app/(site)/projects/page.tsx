import type { Metadata } from 'next';
import { Suspense } from 'react';
import { projects } from '@astrea/research-registry';
import { PageHeader } from '@/components/page-header';
import { ProjectsBrowser } from '@/components/projects-browser';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Apps, models, APIs and experiments from Astrea Labs.',
};

export default function ProjectsPage() {
  const sorted = [...projects].sort((a, b) => a.order - b.order);
  return (
    <div className="container">
      <PageHeader eyebrow="Projects" title="Things we’ve built" />
      <Suspense>
        <ProjectsBrowser projects={sorted} />
      </Suspense>
    </div>
  );
}
