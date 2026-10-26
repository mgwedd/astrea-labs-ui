import 'server-only';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'em', 'strong', 'del', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

/** Markdown to HTML with everything but plain formatting stripped (no scripts, handlers, styles or odd URL schemes). */
export function renderMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { async: false, gfm: true });
  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'] },
    allowedSchemes: ['https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    disallowedTagsMode: 'discard',
  });
}

/** Placeholders Resend fills in per recipient when a Broadcast goes out. */
export const UNSUBSCRIBE_TOKEN_PLACEHOLDER = '{{{contact.unsubscribe_token}}}';
export const RESEND_PREFERENCES_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}';

/**
 * The full email as sent: sanitized body plus footer. The signed link unsubscribes
 * (database and Resend); the Resend placeholder makes Resend add its List-Unsubscribe
 * headers and gives readers its per-topic preferences page.
 */
export function buildEmailHtml(markdown: string, siteUrl: string): string {
  const unsubscribe = `${siteUrl}/email/unsubscribe?t=${UNSUBSCRIBE_TOKEN_PLACEHOLDER}`;
  return [
    renderMarkdown(markdown),
    '<hr>',
    '<p><small>You get this because you opted in on your Astrea Labs account. ',
    `<a href="${unsubscribe}">Unsubscribe</a> · `,
    `<a href="${RESEND_PREFERENCES_PLACEHOLDER}">Email preferences</a></small></p>`,
  ].join('\n');
}

/** The same email with the placeholders filled for one address, for previews and test sends. */
export function fillPlaceholders(html: string, values: { token: string; preferencesUrl: string }): string {
  return html.replaceAll(UNSUBSCRIBE_TOKEN_PLACEHOLDER, values.token).replaceAll(RESEND_PREFERENCES_PLACEHOLDER, values.preferencesUrl);
}
