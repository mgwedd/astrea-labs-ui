'use client';

import Image from 'next/image';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@astrea/ui';

/** Inline image that opens full size in a lightbox. Animated GIFs skip the optimizer. */
export function ZoomableImage({
  src,
  alt,
  width,
  height,
  animated = false,
  priority = false,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  animated?: boolean;
  priority?: boolean;
}) {
  const sized = width && height ? { width, height } : { width: 0, height: 0 };

  return (
    <Dialog>
      <DialogTrigger
        className="block w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Enlarge image: ${alt}`}
      >
        <Image
          src={src}
          alt={alt}
          {...sized}
          sizes="(min-width: 1024px) 768px, 100vw"
          unoptimized={animated}
          priority={priority}
          className="h-auto w-full"
        />
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92vh] max-w-[min(96vw,1600px)] border-0 bg-transparent p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <Image
          src={src}
          alt={alt}
          {...sized}
          sizes="96vw"
          quality={90}
          loading="eager"
          unoptimized={animated}
          className="h-auto max-h-[92vh] w-full rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
