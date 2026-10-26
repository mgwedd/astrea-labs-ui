import { projects } from '@astrea/research-registry';

/** Who a campaign goes to: lab news, or the opted-in users of one registry project. */
export type Audience = 'news' | `product:${string}`;

export const audienceOptions = (): { value: Audience; label: string }[] => [
  { value: 'news', label: 'Lab news' },
  ...projects.map((p) => ({ value: `product:${p.slug}` as Audience, label: `Product: ${p.name}` })),
];

export function parseAudience(v: unknown): Audience | null {
  return audienceOptions().find((o) => o.value === v)?.value ?? null;
}

export const audienceLabel = (a: string) => audienceOptions().find((o) => o.value === a)?.label ?? a;
