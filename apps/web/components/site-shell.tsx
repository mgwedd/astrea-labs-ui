import { projects } from '@astrea/research-registry';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { getPosts } from '@/lib/writing';

/** Public header, footer and main landmark. Used by the (site) layout and the 404 page. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const projectEntries = projects.map((p) => ({ href: `/projects/${p.slug}`, title: p.name, hint: p.tagline }));
  const writingEntries = getPosts().map((p) => ({ href: `/writing/${p.slug}`, title: p.title }));

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader projects={projectEntries} writing={writingEntries} />
      <main id="content" className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
