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

const slugEnv = (slug: string) => slug.toUpperCase().replace(/[^A-Z0-9]/g, '_');

/** Env var holding the Resend topic id: RESEND_TOPIC_NEWS or RESEND_TOPIC_PRODUCT_<SLUG>. */
export const topicEnvName = (a: Audience) => (a === 'news' ? 'RESEND_TOPIC_NEWS' : `RESEND_TOPIC_PRODUCT_${slugEnv(a.slice('product:'.length))}`);
