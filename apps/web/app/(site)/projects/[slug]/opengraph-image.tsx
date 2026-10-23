import { getProject, projects } from '@astrea/research-registry';
import { ogContentType, ogImage, ogSize } from '@/lib/og';

export const alt = 'Astrea Labs project';
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const project = getProject((await params).slug)!;
  return ogImage({ eyebrow: 'Project', title: project.name, subtitle: project.tagline });
}
