import { z } from 'zod';

const iso = z.iso.datetime({ offset: true });

export const AcceptSchema = z.object({
  agreementId: z.string().min(1).max(100),
  version: z.string().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  shownAt: iso,
  tickedAt: z.record(z.string().min(1).max(20), iso).refine((r) => Object.keys(r).length <= 50),
  sentAt: iso,
});

/** Same email rule as the server, for the form. */
export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export type AcceptBody = z.infer<typeof AcceptSchema>;
