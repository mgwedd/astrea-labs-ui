import { z } from 'zod';
import { getFeedbackProject } from './projects';

export const LIMITS = {
  title: 120,
  long: 4000,
  medium: 2000,
  short: 200,
  email: 254,
} as const;

// Common throwaway-mail domains. Not exhaustive; it raises the cost of casual spam.
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com',
  'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'trashmail.com', 'trashmail.net', 'getnada.com',
  'dispostable.com', 'maildrop.cc', 'fakeinbox.com', 'mailnesia.com', 'mintemail.com', 'spamgourmet.com',
  'mohmal.com', 'emailondeck.com', 'burnermail.io', 'moakt.com', 'tmpmail.org', 'discard.email',
  'mailcatch.com', 'anonbox.net', 'spam4.me', 'grr.la', 'inboxkitten.com', 'tempinbox.com',
]);

export const isDisposableEmail = (email: string) => {
  const domain = email.split('@').pop()?.toLowerCase() ?? '';
  return DISPOSABLE.has(domain);
};

const text = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `Keep this under ${max} characters.`);
const optionalText = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).optional().default('');

const common = {
  project: z.string().refine((s) => getFeedbackProject(s) !== undefined, 'Choose a project.'),
  title: text(LIMITS.title, 'A title'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(LIMITS.email, 'That address is too long.')
    .pipe(z.email('Enter a valid email address.'))
    .refine((e) => !isDisposableEmail(e), 'Please use a permanent email address.'),
  // Required tick: "Don't include any client or patient information." Checked server-side too.
  ack: z.literal(true, { error: "Tick this box to confirm you haven't included client or patient information." }),
};

export const BugSchema = z.object({
  ...common,
  type: z.literal('bug'),
  happened: text(LIMITS.long, 'This'),
  steps: text(LIMITS.long, 'This'),
  expected: text(LIMITS.medium, 'This'),
  environment: optionalText(LIMITS.short),
});

export const FeatureSchema = z.object({
  ...common,
  type: z.literal('feature'),
  problem: text(LIMITS.long, 'This'),
  solution: text(LIMITS.long, 'This'),
  alternatives: optionalText(LIMITS.medium),
});

export const FeedbackSchema = z.discriminatedUnion('type', [BugSchema, FeatureSchema], {
  error: 'Choose feature request or bug report.',
});

export type FeedbackInput = z.infer<typeof FeedbackSchema>;
export type FeedbackType = FeedbackInput['type'];

/** Everything except email: the part that ends up in the public issue. */
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type FeedbackContent = DistOmit<FeedbackInput, 'email' | 'ack'>;
