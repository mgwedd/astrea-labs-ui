import path from 'path';
import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';

// lib/agreements/signed/pdf.ts reads these TTFs from disk at runtime, which file
// tracing can't see. The pnpm store path covers the symlink's real target.
const pdfFonts = [
  './node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',
  './node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',
  '../../node_modules/.pnpm/dejavu-fonts-ttf@*/node_modules/dejavu-fonts-ttf/ttf/DejaVuSans{,-Bold}.ttf',
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/api/beta/**': pdfFonts,
    '/aletheia/beta/**': pdfFonts,
  },
  transpilePackages: ['@astrea/ui', '@astrea/research-registry'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'i.vimeocdn.com' },
      // Self-hosted media on Vercel Blob.
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
};

export default withBotId(nextConfig);
