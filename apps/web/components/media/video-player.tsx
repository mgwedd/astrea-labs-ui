'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Self-hosted video. `loop` makes it behave like a GIF (muted, inline, plays
 * only while on screen); otherwise it's a normal player with controls.
 */
export function VideoPlayer({
  src,
  title,
  poster,
  loop = false,
  width,
  height,
}: {
  src: string;
  title: string;
  poster?: string;
  loop?: boolean;
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!loop || !video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReducedMotion(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? video.play().catch(() => {}) : video.pause()),
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [loop]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      title={title}
      aria-label={title}
      muted={loop}
      loop={loop}
      playsInline
      controls={!loop || reducedMotion}
      preload="metadata"
      style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
      className="h-auto w-full rounded-lg border bg-muted"
    />
  );
}
