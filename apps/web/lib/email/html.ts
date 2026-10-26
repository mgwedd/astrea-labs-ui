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

/** Placeholders Resend fills in per recipient when a Broadcast goes out. */
export const UNSUBSCRIBE_TOKEN_PLACEHOLDER = '{{{contact.unsubscribe_token}}}';
export const RESEND_PREFERENCES_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}';

/** The footer added to every campaign at send time. Authors don't include their own. */
export function unsubscribeFooter(siteUrl: string): string {
  const unsubscribe = `${siteUrl}/email/unsubscribe?t=${UNSUBSCRIBE_TOKEN_PLACEHOLDER}`;
  return [
    '<hr>',
    '<p><small>You get this because you opted in on your Astrea Labs account. ',
    `<a href="${unsubscribe}">Unsubscribe</a> · `,
    `<a href="${RESEND_PREFERENCES_PLACEHOLDER}">Email preferences</a></small></p>`,
  ].join('\n');
}

/**
 * The full email as sent: sanitized body plus footer. The signed link unsubscribes
 * (database and Resend); the Resend placeholder makes Resend add its List-Unsubscribe
 * headers and gives readers its per-topic preferences page.
 */
export function buildEmailHtml(html: string, siteUrl: string): string {
  return `${sanitizeCampaignHtml(html)}\n${unsubscribeFooter(siteUrl)}`;
}

/** The same email with the placeholders filled for one address, for previews and test sends. */
export function fillPlaceholders(html: string, values: { token: string; preferencesUrl: string }): string {
  return html.replaceAll(UNSUBSCRIBE_TOKEN_PLACEHOLDER, values.token).replaceAll(RESEND_PREFERENCES_PLACEHOLDER, values.preferencesUrl);
}
