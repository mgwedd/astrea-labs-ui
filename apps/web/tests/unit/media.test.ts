import { describe, expect, it } from 'vitest';
import { embedUrl, parseMedia } from '@/lib/media';

describe('parseMedia', () => {
  it.each([
    ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://youtu.be/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://youtube.com/shorts/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://m.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
  ])('detects YouTube %s', (src, id) => {
    expect(parseMedia(src)).toEqual({ kind: 'youtube', id });
  });

  it('keeps YouTube start times', () => {
    expect(parseMedia('https://youtu.be/abc?t=1m30s')).toEqual({ kind: 'youtube', id: 'abc', start: 90 });
    expect(parseMedia('https://www.youtube.com/watch?v=abc&t=42')).toEqual({ kind: 'youtube', id: 'abc', start: 42 });
  });

  it('detects Vimeo, including unlisted hashes', () => {
    expect(parseMedia('https://vimeo.com/1084537')).toEqual({ kind: 'vimeo', id: '1084537' });
    expect(parseMedia('https://vimeo.com/123/abc123')).toEqual({ kind: 'vimeo', id: '123', hash: 'abc123' });
    expect(parseMedia('https://player.vimeo.com/video/123?h=ff00')).toEqual({ kind: 'vimeo', id: '123', hash: 'ff00' });
  });

  it('classifies files by extension', () => {
    expect(parseMedia('/media/demo.mp4').kind).toBe('video');
    expect(parseMedia('https://x.public.blob.vercel-storage.com/clip.webm?v=2').kind).toBe('video');
    expect(parseMedia('/media/loop.gif').kind).toBe('gif');
    expect(parseMedia('/media/shot.png').kind).toBe('image');
    expect(parseMedia('https://vimeo.com/about').kind).toBe('image');
  });
});

describe('embedUrl', () => {
  it('uses privacy-enhanced players with autoplay', () => {
    expect(embedUrl({ kind: 'youtube', id: 'abc', start: 90 })).toBe(
      'https://www.youtube-nocookie.com/embed/abc?autoplay=1&rel=0&modestbranding=1&playsinline=1&start=90',
    );
    expect(embedUrl({ kind: 'vimeo', id: '123', hash: 'ff' })).toBe(
      'https://player.vimeo.com/video/123?autoplay=1&dnt=1&h=ff',
    );
  });
});
