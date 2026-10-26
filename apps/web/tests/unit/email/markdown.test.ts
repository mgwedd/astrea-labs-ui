import { describe, expect, it } from 'vitest';
import { buildEmailHtml, fillPlaceholders, renderMarkdown } from '@/lib/email/markdown';

describe('campaign markdown', () => {
  it('strips <script>, event handlers and javascript: links', () => {
    const html = renderMarkdown('hi <script>alert(1)</script> <img src="https://x.test/a.png" onerror="x()"> [a](javascript:alert(1))');
    expect(html).not.toMatch(/<script|onerror|javascript:/i);
  });

  it('keeps ordinary formatting', () => {
    expect(renderMarkdown('# Title\n\n**bold** [site](https://astrealabs.com)')).toContain('<strong>bold</strong>');
  });

  it('adds a signed-link unsubscribe footer and the Resend placeholder, filled for previews', () => {
    const html = buildEmailHtml('Hello', 'https://astrealabs.com');
    expect(html).toContain('https://astrealabs.com/email/unsubscribe?t={{{contact.unsubscribe_token}}}');
    expect(html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    const filled = fillPlaceholders(html, { token: 'TOK', preferencesUrl: '#' });
    expect(filled).toContain('unsubscribe?t=TOK');
    expect(filled).not.toContain('{{{');
  });
});
