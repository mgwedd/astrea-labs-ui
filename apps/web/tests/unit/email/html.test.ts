import { describe, expect, it } from 'vitest';
import { buildEmailHtml, fillPlaceholders, sanitizeCampaignHtml, unsubscribeFooter } from '@/lib/email/html';

describe('campaign HTML sanitize', () => {
  it('strips scripts, handlers, javascript: links, iframes and forms', () => {
    const html = sanitizeCampaignHtml(
      '<p onclick="x()">hi</p><script>alert(1)</script><a href="javascript:alert(1)">a</a>' +
        '<img src="https://x.test/a.png" onerror="x()"><iframe src="https://evil.test"></iframe><form action="https://evil.test"><input></form>',
    );
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:|<iframe|<form|<input/i);
    expect(html).toContain('<img src="https://x.test/a.png"');
  });

  it('keeps table layout and safe inline styles', () => {
    const html = sanitizeCampaignHtml(
      '<table width="100%" cellpadding="0"><tr><td style="padding:32px;font-family:Arial;color:#111">Hi <a href="https://astrealabs.com" style="display:inline-block;background:#000">Go</a></td></tr></table>',
    );
    expect(html).toContain('<table width="100%" cellpadding="0">');
    expect(html).toContain('padding:32px');
    expect(html).toContain('href="https://astrealabs.com"');
  });

  it('drops style values that could load a resource, and non-https images and links', () => {
    const html = sanitizeCampaignHtml(
      '<div style="background:url(https://x.test/t.gif);color:red">a</div><img src="http://x.test/a.png"><a href="http://x.test">b</a><a href="//x.test">c</a>',
    );
    expect(html).not.toMatch(/url\(|http:\/\/|\/\/x\.test/);
    expect(html).toContain('color:red');
  });

  it('removes <style>, <head> and <title> contents of a whole document', () => {
    const html = sanitizeCampaignHtml('<!doctype html><html><head><title>Secret</title><style>p{color:red}</style></head><body><p>Body</p></body></html>');
    expect(html).toBe('<p>Body</p>');
  });
});

describe('unsubscribe footer', () => {
  it('is appended after the sanitized body, with the signed-link and Resend placeholders', () => {
    const html = buildEmailHtml('<p>Hello</p><script>x()</script>', 'https://astrealabs.com');
    expect(html.startsWith('<p>Hello</p>')).toBe(true);
    expect(html.endsWith(unsubscribeFooter('https://astrealabs.com'))).toBe(true);
    expect(html).toContain('https://astrealabs.com/email/unsubscribe?t={{{contact.unsubscribe_token}}}');
    expect(html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    expect(html).not.toContain('<script');
  });

  it('cannot be removed by the author and is filled for previews and test sends', () => {
    const html = buildEmailHtml('<p>No footer here</p>', 'https://astrealabs.com');
    const filled = fillPlaceholders(html, { token: 'TOK', preferencesUrl: '#' });
    expect(filled).toContain('unsubscribe?t=TOK');
    expect(filled).not.toContain('{{{');
  });
});
