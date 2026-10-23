import { flag } from 'flags/next';
import { vercelAdapter } from '@flags-sdk/vercel';

/** Managed in Vercel Flags: https://vercel.com/astrea-software/astrea-labs-ui/flag/homepage-announcement */
export const homepageAnnouncement = flag<boolean>({
  key: 'homepage-announcement',
  description: 'Show the announcement pill above the homepage hero',
  defaultValue: true,
  adapter: vercelAdapter,
});
