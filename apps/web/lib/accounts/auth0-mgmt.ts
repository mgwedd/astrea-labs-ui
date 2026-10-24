import 'server-only';
import { ManagementClient } from 'auth0';

/** Server-only config for the Management API. Names are documented in docs/launch-setup.md. */
function config() {
  const { AUTH0_DOMAIN: domain, AUTH0_MGMT_CLIENT_ID: clientId, AUTH0_MGMT_CLIENT_SECRET: clientSecret, AUTH0_PASSWORDLESS_CONNECTION: connection } = process.env;
  if (!domain || !clientId || !clientSecret || !connection) throw new Error('Auth0 Management API env vars are not set');
  return { domain, clientId, clientSecret, connection };
}

export const passwordlessConnection = () => config().connection;

/**
 * Create the passwordless (email one-time code) user for an invited email, unless one exists.
 * `invited` in app_metadata is what the pre-user-registration Action checks. The user signs in
 * with a code emailed to them; there is no password to set.
 */
export async function provisionAccount(email: string): Promise<void> {
  const c = config();
  const mgmt = new ManagementClient({ domain: c.domain, clientId: c.clientId, clientSecret: c.clientSecret });
  const existing = await mgmt.users.listUsersByEmail({ email });
  if (existing.some((u) => u.identities?.some((i) => i.connection === c.connection))) return;
  await mgmt.users.create({ connection: c.connection, email, email_verified: true, app_metadata: { invited: true } });
}

/** The email on an Auth0 user, if Auth0 has verified it. Used to resolve a bearer token's `sub`. */
export async function verifiedEmailFor(sub: string): Promise<string | undefined> {
  const c = config();
  const mgmt = new ManagementClient({ domain: c.domain, clientId: c.clientId, clientSecret: c.clientSecret });
  const user = await mgmt.users.get(sub);
  return user.email && user.email_verified ? user.email.toLowerCase() : undefined;
}
