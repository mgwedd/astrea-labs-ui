import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProjectBySubdomain, PROJECT_SUBDOMAINS } from '@astrea/research-registry';
import { ProjectDetail } from '@/components/project-detail';
import { markdownAlternates } from '@/lib/markdown-route';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return PROJECT_SUBDOMAINS.map((subdomain) => ({ subdomain }));
}

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
  const project = getProjectBySubdomain((await params).subdomain);
  if (!project) return {};
  return {
    title: { absolute: `${project.name} · Astrea Labs` },
    description: project.tagline,
    alternates: { ...markdownAlternates(`/projects/${project.slug}`), canonical: `/projects/${project.slug}` },
  };
}

/** Landing page for `<subdomain>.astrealabs.com`, rewritten here by middleware. */
export default async function SubdomainPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const project = getProjectBySubdomain((await params).subdomain);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
