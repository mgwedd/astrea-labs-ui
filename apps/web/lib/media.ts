export type MediaSource =
  | { kind: 'youtube'; id: string; start?: number }
  | { kind: 'vimeo'; id: string; hash?: string }
  | { kind: 'video'; src: string }
  | { kind: 'gif'; src: string }
  | { kind: 'image'; src: string };

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
const GIF_EXT = /\.gif(\?|#|$)/i;

/** Classifies a media URL or `/public` path so one component can render any of them. */
export function parseMedia(src: string): MediaSource {
  let url: URL | undefined;
  try {
    url = new URL(src);
  } catch {
    // Relative path under /public.
  }

  if (url) {
    const host = url.hostname.replace(/^(www\.|m\.)/, '');
    if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const id =
        host === 'youtu.be'
          ? url.pathname.slice(1)
          : (url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]);
      if (id) {
        const t = url.searchParams.get('t') ?? url.searchParams.get('start');
        const start = t ? parseTime(t) : undefined;
        return { kind: 'youtube', id, ...(start ? { start } : {}) };
      }
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([0-9a-f]+))?/);
      if (m) {
        const hash = m[2] ?? url.searchParams.get('h') ?? undefined;
        return { kind: 'vimeo', id: m[1], ...(hash ? { hash } : {}) };
      }
    }
  }

  if (VIDEO_EXT.test(src)) return { kind: 'video', src };
  if (GIF_EXT.test(src)) return { kind: 'gif', src };
  return { kind: 'image', src };
}

/** `90`, `90s`, `1m30s`, `1h2m3s` → seconds. */
function parseTime(t: string): number | undefined {
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !m[0]) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function embedUrl(source: Extract<MediaSource, { kind: 'youtube' | 'vimeo' }>): string {
  if (source.kind === 'youtube') {
    const params = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1', playsinline: '1' });
    if (source.start) params.set('start', String(source.start));
    return `https://www.youtube-nocookie.com/embed/${source.id}?${params}`;
  }
  const params = new URLSearchParams({ autoplay: '1', dnt: '1' });
  if (source.hash) params.set('h', source.hash);
  return `https://player.vimeo.com/video/${source.id}?${params}`;
}
