import { ogContentType, ogImage, ogSize } from '@/lib/og';

export const alt = 'Astrea Labs — AI research focusing on embedded systems';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogImage({
    title: 'AI research: embedded systems.',
  });
}
