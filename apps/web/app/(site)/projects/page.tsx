import type { Metadata } from 'next';
import { Suspense } from 'react';
import { projects } from '@astrea/research-registry';
import { PageActions } from '@/components/page-actions';
import { PageHeader } from '@/components/page-header';
import { ProjectsBrowser } from '@/components/projects-browser';
import { markdownAlternates } from '@/lib/markdown-route';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Apps, models, APIs and experiments from Astrea Labs.',
  alternates: markdownAlternates('/projects'),
};

export default function ProjectsPage() {
  const sorted = [...projects].sort((a, b) => a.order - b.order);
  return (
    <div className="container">
      <PageHeader eyebrow="Projects" title="Things we’ve built" actions={<PageActions path="/projects" />} />
      <Suspense>
        <ProjectsBrowser projects={sorted} />
      </Suspense>
    </div>
  );
}
