import type { Metadata } from 'next';
import Link from 'next/link';
import { NotebookPen } from 'lucide-react';
import { Badge, Empty, Separator } from '@astrea/ui';
import { PageActions } from '@/components/page-actions';
import { PageHeader } from '@/components/page-header';
import { markdownAlternates } from '@/lib/markdown-route';
import { formatDate, getPosts } from '@/lib/writing';

export const metadata: Metadata = { title: 'Writing', description: 'Notes, release write-ups and essays from Astrea Labs.', alternates: markdownAlternates('/writing') };

export default function WritingPage() {
  const posts = getPosts();
  return (
    <div className="container max-w-3xl">
      <PageHeader eyebrow="Writing" title="Notes from the lab" actions={<PageActions path="/writing" />} />
      {posts.length === 0 ? (
        <Empty icon={NotebookPen} title="Nothing published yet" description="Posts will appear here." className="mb-16" />
      ) : (
        <ul className="flex flex-col pb-16">
          {posts.map((post, i) => (
            <li key={post.slug}>
              {i > 0 && <Separator />}
              <Link href={`/writing/${post.slug}`} className="group flex flex-col gap-2 py-6">
                <span className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  <span>·</span>
                  <span>{post.readingMinutes} min read</span>
                </span>
                <span className="text-xl font-semibold tracking-tight group-hover:underline">{post.title}</span>
                <span className="text-muted-foreground">{post.summary}</span>
                {post.tags.length > 0 && (
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    {post.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
