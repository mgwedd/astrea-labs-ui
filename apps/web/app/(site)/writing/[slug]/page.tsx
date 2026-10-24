import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getProject } from '@astrea/research-registry';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Separator } from '@astrea/ui';
import { mdxComponents } from '@/components/media/mdx';
import { PageActions } from '@/components/page-actions';
import { markdownAlternates } from '@/lib/markdown-route';
import { formatDate, getPost, getPosts } from '@/lib/writing';
import { site } from '@/lib/site';

export const dynamicParams = false;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    openGraph: { type: 'article', publishedTime: post.date, authors: [site.founder] },
    alternates: markdownAlternates(`/writing/${post.slug}`),
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const project = post.project ? getProject(post.project) : undefined;

  return (
    <article className="container max-w-3xl pb-16">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-3" asChild>
          <Link href="/writing">
            <ArrowLeft /> Writing
          </Link>
        </Button>
        <PageActions path={`/writing/${post.slug}`} />
      </div>
      <header className="flex flex-col gap-4 pb-8 pt-6">
        <span className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>·</span>
          <span>{post.readingMinutes} min read</span>
        </span>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight">{post.title}</h1>
        <p className="text-pretty text-xl text-muted-foreground">{post.summary}</p>
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {t}
            </Badge>
          ))}
        </div>
      </header>
      <Separator />
      <div className="prose prose-neutral max-w-none pt-8 dark:prose-invert prose-headings:tracking-tight prose-a:underline-offset-4">
        <MDXRemote source={post.body} components={mdxComponents} />
      </div>
      {project && (
        <Link href={`/projects/${project.slug}`} className="group mt-12 block">
          <Card className="transition-colors group-hover:bg-muted/40">
            <CardHeader>
              <CardDescription>Project</CardDescription>
              <CardTitle className="flex items-center justify-between">
                {project.name}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </CardTitle>
              <CardDescription>{project.tagline}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      )}
    </article>
  );
}
