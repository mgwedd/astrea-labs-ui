import path from 'node:path';
import { imageSizeFromFile } from 'image-size/fromFile';
import { cn } from '@astrea/ui';
import { embedUrl, parseMedia } from '@/lib/media';
import { EmbedPlayer } from './embed-player';
import { VideoPlayer } from './video-player';
import { ZoomableImage } from './zoomable-image';

export interface MediaProps {
  /** Image, GIF, video file (`/media/x.mp4` or a storage URL), or a YouTube/Vimeo link. */
  src: string;
  alt?: string;
  caption?: React.ReactNode;
  /** Poster frame for self-hosted video. */
  poster?: string;
  /** Self-hosted video only: play muted and looping like a GIF. */
  loop?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
}

/** Renders any supported media type from a single `src`. */
export async function Media({ src, alt = '', caption, poster, loop, width, height, priority, className }: MediaProps) {
  const source = parseMedia(src);
  const title = alt || (typeof caption === 'string' ? caption : 'Video');
  const dims = width && height ? { width, height } : await localSize(src);

  let content: React.ReactNode;
  switch (source.kind) {
    case 'youtube':
      content = (
        <EmbedPlayer
          src={embedUrl(source)}
          title={title}
          thumbnail={poster ?? `https://i.ytimg.com/vi/${source.id}/maxresdefault.jpg`}
          fallbackThumbnail={`https://i.ytimg.com/vi/${source.id}/hqdefault.jpg`}
        />
      );
      break;
    case 'vimeo':
      content = (
        <EmbedPlayer src={embedUrl(source)} title={title} thumbnail={poster ?? (await vimeoThumbnail(src))} />
      );
      break;
    case 'video':
      content = <VideoPlayer src={src} title={title} poster={poster} loop={loop} {...dims} />;
      break;
    default:
      content = <ZoomableImage src={src} alt={alt} animated={source.kind === 'gif'} priority={priority} {...dims} />;
  }

  return (
    <figure className={cn('not-prose my-8 flex flex-col gap-3', className)}>
      {content}
      {caption && <figcaption className="text-center text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

/** Reads intrinsic dimensions of files under /public so layout doesn't shift. */
async function localSize(src: string): Promise<{ width?: number; height?: number }> {
  if (!src.startsWith('/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(src)) return {};
  try {
    const { width, height } = await imageSizeFromFile(path.join(process.cwd(), 'public', src));
    return { width, height };
  } catch {
    return {};
  }
}

async function vimeoThumbnail(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(url)}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return undefined;
    return ((await res.json()) as { thumbnail_url?: string }).thumbnail_url;
  } catch {
    return undefined;
  }
}
