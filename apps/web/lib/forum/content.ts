import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const MAX_BODY_CHARS = 20_000;

const ALLOWED_TAGS = ['p', 'br', 'hr', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'em', 'strong', 'del', 'a'];

/** Allowlist sanitizer for forum bodies: formatting and links only. No images, scripts, styles or event handlers. */
export function sanitizeBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'title', 'rel'] },
    allowedSchemes: ['https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      h1: 'h2',
      a: (tag, attribs) => ({ tagName: tag, attribs: { ...attribs, rel: 'nofollow noopener noreferrer' } }),
    },
  });
}

/** Markdown source to sanitized HTML. */
export function markdownToHtml(markdown: string): string {
  return sanitizeBody(marked.parse(markdown, { async: false, gfm: true, breaks: true }));
}

/** The visible text of sanitized or untrusted HTML. */
export function plainText(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|li|h[1-6]|blockquote|pre|div)>|<br\s*\/?>/gi, ' '), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const MENTION = /(^|[^\w@/.-])@([a-z0-9][a-z0-9_-]{1,31})(?![\w@-])/gi;

/** The distinct lowercase names mentioned in plain text. Emails (a@b) and bare `@` are not mentions. */
export function extractMentionNames(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(MENTION)) found.add(m[2].toLowerCase());
  return [...found];
}

/**
 * Wrap resolved mentions in sanitized HTML as `<span class="mention" data-mention="name">@name</span>`.
 * Only text outside tags, and outside `<a>`, `<code>` and `<pre>`, is touched. `known` holds lowercase names.
 */
export function wrapMentions(html: string, known: Set<string>): string {
  if (known.size === 0) return html;
  let skip = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        const m = /^<(\/?)(a|code|pre)[\s>]/i.exec(part);
        if (m) skip += m[1] ? -1 : 1;
        return part;
      }
      if (skip > 0) return part;
      return part.replace(MENTION, (whole, lead: string, name: string) =>
        known.has(name.toLowerCase()) ? `${lead}<span class="mention" data-mention="${name.toLowerCase()}">@${name}</span>` : whole,
      );
    })
    .join('');
}
