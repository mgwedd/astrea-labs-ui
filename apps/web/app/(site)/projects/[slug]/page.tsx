import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject, projects } from '@astrea/research-registry';
import { ProjectDetail } from '@/components/project-detail';
import { markdownAlternates } from '@/lib/markdown-route';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const project = getProject((await params).slug);
  if (!project) return {};
  return { title: project.name, description: project.tagline, alternates: markdownAlternates(`/projects/${project.slug}`) };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const project = getProject((await params).slug);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
