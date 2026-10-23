/** Emails allowed into /admin: ADMIN_EMAILS, comma-separated, case-insensitive. */
export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True only for a verified email that is on the allowlist. An empty allowlist admits nobody. */
export function isAdminUser(
  user: { email?: string; email_verified?: boolean } | undefined,
  allowlistRaw: string | undefined = process.env.ADMIN_EMAILS,
): boolean {
  if (!user?.email || user.email_verified !== true) return false;
  return parseAdminEmails(allowlistRaw).includes(user.email.trim().toLowerCase());
}
