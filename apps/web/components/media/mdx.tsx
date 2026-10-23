import { Children, isValidElement } from 'react';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { Media } from './media';

/** `![alt](src "caption")` works for images, GIFs, video files and YouTube/Vimeo links. */
function MdxImage({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  if (!src) return null;
  // Markdown-embedded video files are short clips, so they loop like GIFs.
  return <Media src={src} alt={alt} caption={title} loop />;
}

/** Markdown wraps a lone image in <p>; unwrap it so <figure> isn't nested in a paragraph. */
function Paragraph({ children }: { children?: React.ReactNode }) {
  const only = Children.toArray(children);
  if (only.length === 1 && isValidElement(only[0]) && (only[0].type === MdxImage || only[0].type === Media)) {
    return <>{children}</>;
  }
  return <p>{children}</p>;
}

export const mdxComponents: MDXRemoteProps['components'] = { img: MdxImage, p: Paragraph, Media };
