'use client';

import { useState } from 'react';
import { preconnect } from 'react-dom';
import Image from 'next/image';
import { Play } from 'lucide-react';

/**
 * Click-to-load facade for YouTube/Vimeo: a static thumbnail until the visitor
 * presses play, so pages don't pay for third-party players up front.
 */
export function EmbedPlayer({
  src,
  title,
  thumbnail,
  fallbackThumbnail,
}: {
  src: string;
  title: string;
  thumbnail?: string;
  fallbackThumbnail?: string;
}) {
  const [active, setActive] = useState(false);
  const [thumb, setThumb] = useState(thumbnail);
  const warm = () => preconnect(new URL(src).origin);

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
      {active ? (
        <iframe
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          onPointerEnter={warm}
          onFocus={warm}
          aria-label={`Play video: ${title}`}
          className="group absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {thumb && (
            <Image
              src={thumb}
              alt=""
              fill
              sizes="(min-width: 1024px) 768px, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
              onError={() => setThumb(thumb === fallbackThumbnail ? undefined : fallbackThumbnail)}
            />
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/10 transition-colors group-hover:bg-black/0">
            <span className="grid size-16 place-items-center rounded-full bg-background/85 text-foreground shadow-lg backdrop-blur transition-transform group-hover:scale-105 motion-reduce:transition-none">
              <Play className="ml-1 size-6 fill-current" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
