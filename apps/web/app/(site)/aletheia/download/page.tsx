import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject } from '@astrea/research-registry';
import { AppDownloadCard } from '@/components/app-download-card';
import { PageHeader } from '@/components/page-header';
import { getLatestRelease } from '@/lib/releases';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Download Aletheia',
  description: 'Download the latest Aletheia build for macOS. The beta needs a free license.',
};

export default async function AletheiaDownloadPage() {
  const project = getProject('aletheia');
  if (!project?.downloads?.length) notFound();
  const release = project.releases ? await getLatestRelease(project.releases) : null;

  return (
    <div className="container max-w-3xl pb-16">
      <PageHeader eyebrow="Aletheia" title="Download Aletheia">
        The latest build for macOS.
      </PageHeader>
      <AppDownloadCard project={project} release={release} />
      <section aria-labelledby="requirements" className="mt-10">
        <h2 id="requirements" className="mb-3 text-lg font-semibold">
          Requirements
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>macOS 14 or later</li>
          <li>At least 8 GB of memory</li>
          <li>Apple Silicon with 16 GB of memory recommended; Intel Macs work with smaller, slower models</li>
          <li>About 3 to 8 GB of free disk space, including the AI models</li>
          <li>A free beta license key, issued after review</li>
        </ul>
      </section>
    </div>
  );
}
