import type { Metadata } from 'next';
import { projects } from '@astrea/research-registry';
import { AppDownloadCard } from '@/components/app-download-card';
import { PageHeader } from '@/components/page-header';
import { getLatestRelease } from '@/lib/releases';

export const revalidate = 3600;
export const metadata: Metadata = { title: 'Downloads', description: 'Desktop builds of Astrea Labs apps.' };

export default async function DownloadsPage() {
  const apps = projects.filter((p) => p.downloads?.length).sort((a, b) => a.order - b.order);
  const releases = await Promise.all(apps.map((p) => (p.releases ? getLatestRelease(p.releases) : null)));

  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Downloads" title="Get the apps" />
      <div className="grid gap-6 lg:grid-cols-2">
        {apps.map((p, i) => (
          <AppDownloadCard key={p.slug} project={p} release={releases[i]} />
        ))}
      </div>
    </div>
  );
}
