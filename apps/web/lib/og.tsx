import { ImageResponse } from 'next/og';
import { site } from './site';

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

const STAR = 'M12 1.5c.5 5.6 4.9 10 10.5 10.5-5.6.5-10 4.9-10.5 10.5-.5-5.6-4.9-10-10.5-10.5C7.1 11.5 11.5 7.1 12 1.5Z';

export function Star({ size, color = '#f8fafc' }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d={STAR} fill={color} />
    </svg>
  );
}

/** Shared social card: slate-950 background, wordmark, eyebrow, title and subtitle. */
export function ogImage({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#020817',
          backgroundImage: 'radial-gradient(circle at 85% 15%, #1e293b 0%, #020817 55%)',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 32, fontWeight: 600 }}>
          <Star size={40} />
          {site.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {eyebrow && (
            <div style={{ fontSize: 24, letterSpacing: 4, textTransform: 'uppercase', color: '#94a3b8' }}>{eyebrow}</div>
          )}
          <div style={{ fontSize: title.length > 40 ? 64 : 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 32, lineHeight: 1.35, color: '#94a3b8', maxWidth: 960 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: '#64748b' }}>{site.url.replace('https://', '')}</div>
      </div>
    ),
    ogSize,
  );
}
