import 'server-only';
import sanitizeHtml from 'sanitize-html';

/** Largest campaign body accepted, in characters. Pasted or uploaded HTML from an email builder is often large. */
export const MAX_CAMPAIGN_HTML = 200_000;

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'div', 'span', 'center', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'blockquote', 'pre', 'code', 'em', 'i', 'strong', 'b', 'u', 's', 'del', 'small', 'sub', 'sup',
  'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
];

// Inline styles survive (email layout depends on them), but a value may not load anything or run anything.
// Backslashes are refused too: CSS escapes (`u\72l(`) would otherwise slip a url() past the check.
const SAFE_STYLE_VALUE = /^(?!.*(?:url\s*\(|expression|javascript|@import|behavior|-moz-binding))[^;{}<>\\]*$/i;
const STYLE_PROPERTIES = [
  'background', 'background-color', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-color', 'border-style', 'border-width', 'border-radius', 'border-collapse', 'border-spacing',
  'color', 'display', 'font', 'font-family', 'font-size', 'font-style', 'font-weight', 'height', 'width',
  'line-height', 'letter-spacing', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'max-width', 'min-width', 'max-height', 'min-height', 'padding', 'padding-top', 'padding-right',
  'padding-bottom', 'padding-left', 'text-align', 'text-decoration', 'text-transform', 'vertical-align',
  'white-space', 'word-break', 'overflow-wrap',
];
const allowedStyles = { '*': Object.fromEntries(STYLE_PROPERTIES.map((p) => [p, [SAFE_STYLE_VALUE]])) };

const LAYOUT_ATTRS = ['style', 'align', 'valign', 'width', 'height', 'bgcolor', 'dir', 'lang'];

/**
 * Pasted or uploaded campaign HTML reduced to what is safe in an email and on the
 * admin preview: no scripts, handlers, forms, iframes, <style>/<head> content, or odd
 * URL schemes. Layout tags, inline styles and https images and links are kept.
 * Runs on the server before the HTML is previewed, stored or sent.
 */
export function sanitizeCampaignHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': LAYOUT_ATTRS,
      a: [...LAYOUT_ATTRS, 'href', 'title'],
      img: [...LAYOUT_ATTRS, 'src', 'alt', 'title'],
      table: [...LAYOUT_ATTRS, 'border', 'cellpadding', 'cellspacing', 'role'],
      td: [...LAYOUT_ATTRS, 'colspan', 'rowspan'],
      th: [...LAYOUT_ATTRS, 'colspan', 'rowspan', 'scope'],
      col: ['span', 'width'],
      colgroup: ['span', 'width'],
    },
    allowedStyles,
    allowedSchemes: ['https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    // Drop the contents of these as well as the tags, so a whole document's <head> text doesn't leak into the body.
    nonTextTags: ['style', 'script', 'textarea', 'option', 'head', 'title', 'noscript', 'template'],
  });
}

/** Stands in for each recipient's signed unsubscribe token until the email is built for that address. */
export const UNSUBSCRIBE_TOKEN_PLACEHOLDER = '%%UNSUBSCRIBE_TOKEN%%';

export const unsubscribePageUrl = (siteUrl: string, token: string) => `${siteUrl}/email/unsubscribe?t=${token}`;
export const oneClickUrl = (siteUrl: string, token: string) => `${siteUrl}/email/unsubscribe/one-click?t=${token}`;

/** RFC 8058 one-click unsubscribe headers for one recipient. */
export const unsubscribeHeaders = (siteUrl: string, token: string): Record<string, string> => ({
  'List-Unsubscribe': `<${oneClickUrl(siteUrl, token)}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});

/** The footer added to every campaign at send time. Authors don't include their own. */
export function unsubscribeFooter(siteUrl: string): string {
  return [
    '<hr>',
    '<p><small>You get this because you opted in on your Astrea Labs account. ',
    `<a href="${unsubscribePageUrl(siteUrl, UNSUBSCRIBE_TOKEN_PLACEHOLDER)}">Unsubscribe</a> · `,
    `<a href="${siteUrl}/account">Email preferences</a></small></p>`,
  ].join('\n');
}

/** The full email before it is built per recipient: sanitized body plus footer, with the token placeholder in the unsubscribe link. */
export function buildEmailHtml(html: string, siteUrl: string): string {
  return `${sanitizeCampaignHtml(html)}\n${unsubscribeFooter(siteUrl)}`;
}

/** The email for one recipient: their signed token in the unsubscribe link. */
export function fillPlaceholders(html: string, token: string): string {
  return html.replaceAll(UNSUBSCRIBE_TOKEN_PLACEHOLDER, token);
}
