import { z } from 'zod';

/** Body of the lost-license form. The client and /api/licenses/request both check it. */
export const LicenseRequestBody = z.object({ email: z.string().trim().max(254).pipe(z.email()) });
