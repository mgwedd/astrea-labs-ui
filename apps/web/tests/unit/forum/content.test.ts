// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractMentionNames, markdownToHtml, plainText, sanitizeBody, wrapMentions } from '@/lib/forum/content';
import { HANDLE_PATTERN, isValidUsername, randomHandle, usernameFromEmail } from '@/lib/forum/names';

describe('sanitizeBody', () => {
  it('keeps formatting and strips scripts, handlers, styles, images and iframes', () => {
    const out = sanitizeBody(
      '<p onclick="x()" style="color:red">Hi <strong>there</strong></p><script>alert(1)</script><img src="https://x/y.png" onerror="z()"><iframe src="https://evil"></iframe>',
    );
    expect(out).toBe('<p>Hi <strong>there</strong></p>');
  });
  it('rejects javascript: and data: links and adds rel to safe links', () => {
    expect(sanitizeBody('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript');
    expect(sanitizeBody('<a href="data:text/html,hi">x</a>')).not.toContain('data:');
    expect(sanitizeBody('<a href="https://example.com">x</a>')).toContain('rel="nofollow noopener noreferrer"');
  });
  it('renders Markdown through the same allowlist', () => {
    const out = markdownToHtml('**bold** <script>x</script> ![i](https://x/y.png) [l](javascript:alert(1))');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).not.toMatch(/script|<img|javascript/);
  });
});

describe('mentions', () => {
  it('extracts distinct lowercase names', () => {
    expect(extractMentionNames('Thanks @Dancing-Stark and @jsample, also @jsample!')).toEqual(['dancing-stark', 'jsample']);
  });
  it('ignores emails, bare @ and one-character names', () => {
    expect(extractMentionNames('mail me at a@example.com or @ or @x')).toEqual([]);
  });
  it('handles mentions at the start, after punctuation and in parentheses', () => {
    expect(extractMentionNames('@one, (@two) and "@three"')).toEqual(['one', 'two', 'three']);
  });
  it('wraps only known names, and not inside code, pre or links', () => {
    const html = '<p>hi @bob and @nobody</p><p><code>@bob</code> <a href="https://x.test">@bob</a></p><pre>@bob</pre>';
    const out = wrapMentions(html, new Set(['bob']));
    expect(out).toContain('<span class="mention" data-mention="bob">@bob</span> and @nobody');
    expect(out.match(/class="mention"/g)).toHaveLength(1);
  });
  it('plainText separates paragraphs so names do not run together', () => {
    expect(extractMentionNames(plainText('<p>@alice</p><p>bob</p>'))).toEqual(['alice']);
  });
});

describe('names', () => {
  it('generates adjective-noun handles', () => {
    for (let i = 0; i < 50; i++) expect(randomHandle()).toMatch(HANDLE_PATTERN);
  });
  it('derives a safe username from an email', () => {
    expect(usernameFromEmail('Jane.Doe+beta@Example.com')).toBe('janedoebeta');
    expect(usernameFromEmail('a@x.com')).toMatch(/^member/);
    expect(isValidUsername(usernameFromEmail('admin@x.com'))).toBe(true);
  });
  it('rejects reserved names and handle lookalikes', () => {
    expect(isValidUsername('admin')).toBe(false);
    expect(isValidUsername('dancing-stark')).toBe(false);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('Has Space')).toBe(false);
    expect(isValidUsername('jsample')).toBe(true);
  });
});
