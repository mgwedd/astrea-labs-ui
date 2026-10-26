import { Fragment } from 'react';
import Link from 'next/link';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/beta-access/content';

const LINKS: Record<string, string> = { [TERMS_PATH]: '/aletheia/terms', [PRIVACY_PATH]: '/aletheia/privacy' };

// Renders the spec's inline markers (**bold**, *italic*) without changing the
// text itself: the stored hash is over the exact string, markers included. The
// Terms and Privacy addresses named in C1 become links to those pages.
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|astrealabs\.com\/aletheia\/(?:terms|privacy))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        const href = LINKS[part];
        if (href) {
          return (
            <Link key={i} href={href} target="_blank" className="underline underline-offset-4 hover:text-foreground">
              {part}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
