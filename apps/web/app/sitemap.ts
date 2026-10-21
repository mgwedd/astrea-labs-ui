import type { MetadataRoute } from 'next';
import { projects } from '@astrea/research-registry';
import { getPosts } from '@/lib/writing';
import { site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', ...site.nav.map((n) => n.href)].map((p) => ({ url: `${site.url}${p}` }));
  return [
    ...pages,
    ...projects.map((p) => ({ url: `${site.url}/projects/${p.slug}` })),
    ...getPosts().map((p) => ({ url: `${site.url}/writing/${p.slug}`, lastModified: p.date })),
  ];
}
