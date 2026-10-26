import { MDXRemote } from 'next-mdx-remote/rsc';
import { PageHeader } from '@/components/page-header';
import { ALETHEIA_DOC_FILES, fetchAletheiaDoc, rewriteLink, type AletheiaDocId } from '@/lib/aletheia-docs';

const TITLES: Record<AletheiaDocId, string> = { terms: 'Terms of Service', privacy: 'Privacy Policy' };

// The markdown comes from the Aletheia repo. It is parsed as plain markdown
// (no JSX or expressions), raw HTML is dropped, images are not rendered, and
// links are rewritten by rewriteLink.
function Link({ href, children }: { href?: string; children?: React.ReactNode }) {
  const to = rewriteLink(href);
  if (!to) return <>{children}</>;
  const external = /^(https?:|mailto:)/i.test(to);
  return (
    <a href={to} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

const components = {
  a: Link,
  img: () => null,
  // The page header is the h1.
  h1: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
};

export async function AletheiaDocPage({ id }: { id: AletheiaDocId }) {
  const doc = await fetchAletheiaDoc(id);
  return (
    <div className="container max-w-3xl pb-16">
      <PageHeader eyebrow="Aletheia · Legal" title={`Aletheia ${TITLES[id]}`}>
        Version {doc.version}. Published by the Aletheia project:{' '}
        <a
          href={`https://github.com/mgwedd/aletheia/blob/main/${ALETHEIA_DOC_FILES[id]}`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          {ALETHEIA_DOC_FILES[id]}
        </a>
        .
      </PageHeader>
      <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:underline-offset-4">
        <MDXRemote source={doc.markdown} components={components} options={{ mdxOptions: { format: 'md' } }} />
      </div>
    </div>
  );
}
