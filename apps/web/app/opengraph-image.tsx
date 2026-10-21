import { ogContentType, ogImage, ogSize } from '@/lib/og';

export const alt = 'Astrea Labs — a small lab for private AI, autonomous systems, and secure software';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogImage({
    title: 'A small lab for private AI, autonomous systems, and secure software.',
  });
}
