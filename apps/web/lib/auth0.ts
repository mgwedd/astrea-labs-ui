import { Auth0Client } from '@auth0/nextjs-auth0/server';

/** Reads APP_BASE_URL, AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET and AUTH0_SECRET. */
export const auth0 = new Auth0Client();
