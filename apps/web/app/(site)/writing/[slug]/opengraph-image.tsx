import { formatDate, getPost, getPosts } from '@/lib/writing';
import { ogContentType, ogImage, ogSize } from '@/lib/og';

export const alt = 'Astrea Labs writing';
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug)!;
  return ogImage({ eyebrow: `Writing · ${formatDate(post.date)}`, title: post.title, subtitle: post.summary });
}
