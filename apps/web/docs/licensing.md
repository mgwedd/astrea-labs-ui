# Aletheia beta licensing (server side)

The client contract is `LICENSING-CONTRACT.local.md` in the Aletheia repo. This doc covers what runs here.

## Client handoff

The license key page has an "Open in Aletheia" button that opens `aletheia://license?key=...`. The Mac app must implement that URL handler; it checks the key offline.

## Endpoints

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/aletheia/beta` | page | none | Email form (one email field, unticked updates box). |
| `/api/licenses/request` | POST `{email, updatesOptIn}` | BotID | Issues a license, or resends the active one. Always `202 {ok:true}` so addresses can't be probed. Limit: 3/hour, 6/day per email. An address with a revoked, unreplaced, unexpired license gets nothing until an admin reissues. |
| `/api/licenses/revocations` | GET | none | Signed `ALETR1.` list. `Cache-Control: public, max-age=3600`. Query strings 301 to the bare URL so they can't split the CDN cache. No cookies or logging. |
| `/api/licenses/admin` | POST | `Bearer LICENSE_ADMIN_TOKEN` | `{action:"list",email}`, `{action:"revoke",lid,reason,by}` (also revokes its renewals), `{action:"reissue",lid,revokeOld,reason?,expiresAt?,by?}` (`expiresAt`: ISO date-time, or `null` for never; omitted keeps the old license's policy). `by` names who revoked and is stored on the license; it is required for revoke and for reissue with `revokeOld`. |
| `/api/licenses/renewals` | GET (Vercel Cron, daily 15:00 UTC) | `Bearer CRON_SECRET` | Emails a fresh license, of the same length, to anyone with an expiring license within 30 days of its end (`RENEWAL_WINDOW_DAYS` in `lib/licensing/service.ts`). The key page shows a renewed key only after the licensee confirms C2 again (`/api/beta/key` answers `409` until then); the confirmation is stored as an `aletheia-beta-renewal` acceptance. |

## Terms and privacy (acceptance records)

The Aletheia repo owns `TERMS.md` and `PRIVACY.md`. The site fetches them from `raw.githubusercontent.com/mgwedd/aletheia/main` (`lib/aletheia-docs.ts`, cached for an hour) and renders them at `/aletheia/terms` and `/aletheia/privacy`. Their `_Last updated: YYYY-MM-DD_` line is the version; both files must carry the same one. Nothing is hard-coded: a failed fetch, a missing version line or differing versions throws, so those pages, `/aletheia/beta/apply` and applying/signing fail rather than show or record anything stale. To publish new terms, update the files in the Aletheia repo; the site picks them up within the hour.

When an applicant applies, the form sends the version its C1 checkbox named. The server rejects the application if that is no longer the current version, and otherwise stores `[{d, v, h}]` for both documents (`beta_applications.accepted_docs`; `h` is the SHA-256 of the exact bytes fetched). `acceptanceFor` (`lib/licensing/acceptance.ts`) builds the token's `acc` from that record and the C1 tick time. Applications from before this was recorded have no record and get no `acc`.

C1's text names the version, so a new terms version changes C1's hash. An applicant who ticked C1 under an older version can no longer open or sign the document and has to apply again.

Licenses expire. A license from an approved beta application runs `BETA_LICENSE_MONTHS` (6) months (`lib/beta-access/service.ts`), and its token carries that `exp`. Any other issue defaults to `DEFAULT_LICENSE_MONTHS` (12, `lib/licensing/service.ts`). An admin reissue can set `expiresAt`, or `null` for a license that never expires; a token without `exp` is valid until revoked. Revoked non-expiring licenses stay on the revocation list for good (the list is capped at 256 KB, roughly 6,000 entries).

**Test licenses.** The admin Licenses page keeps up to three test licenses live for trying a build before telling users (`lib/licensing/test-license.ts`). Each has a label and lasts 1, 3, 7 or 30 days. It is signed with the production key, so release builds accept it, with tier `test` and a `test-<uuid>` license id. Only a small `test_licenses` row is stored (label, issuing admin, dates): no license row, key link or email. An admin can reveal the key at any time; it is rebuilt from the row, so it is the same each time. Revoking puts the id on the revocation list until it would have expired. Expired rows are deleted, so nothing piles up.

Tokens are never stored. They are rebuilt from the `licenses` row, so a resend sends identical bytes.

## Keys

Vercel KMS doesn't support Ed25519, so the signing key is a 32-byte seed in a Sensitive env var.

```bash
node scripts/licensing/keygen.ts <kid> | vercel env add LICENSE_SIGNING_SEED production --sensitive
```

The seed goes to stdout (piped straight into Vercel); `{kid, publicKey}` goes to stderr. Give the client the kid and public key, and set `LICENSE_SIGNING_KID` to the same kid.

**Next key:** run keygen again with the next kid and keep that seed somewhere safe (or in a second Sensitive var). Ship its public key in the app now. To rotate, swap `LICENSE_SIGNING_KID` and `LICENSE_SIGNING_SEED` and redeploy. Licenses signed with the old kid keep working for as long as the app still ships that public key; a resend re-issues them under the new key.

## Env vars

`DATABASE_URL`, `LICENSE_SIGNING_KID`, `LICENSE_SIGNING_SEED`, `RESEND_API_KEY`, `LICENSE_EMAIL_FROM`, `LICENSE_ADMIN_TOKEN`, `CRON_SECRET`.

## Database

Neon Postgres via Drizzle. Schema: `lib/licensing/db/schema.ts`.

```bash
pnpm db:generate   # after schema changes
pnpm db:migrate    # applies drizzle/ to DATABASE_URL
```

Against production, without writing secrets to disk (run from the repo root, where the project is linked):

```bash
vercel env run -e production -- pnpm --filter @astrea/web db:migrate
```

Databases are separate per environment: Production uses one Neon database; Development and Preview share a separate dev database. Local dev must never point at Production.

## Local development

```bash
vercel env run -e development -- pnpm --filter @astrea/web dev:https   # https://localhost:3000
```

- `DATABASE_URL` comes from Vercel's Development env (the dev database) at startup and is never written to disk. Migrate it with `vercel env run -e development -- pnpm --filter @astrea/web db:migrate`.
- `LICENSE_SIGNING_KID` and `LICENSE_SIGNING_SEED` come from Vercel's Development env, which overrides `apps/web/.env.local`. The `.env.local` key (kid `dev-1`) is only used by a plain `pnpm dev` without `vercel env run`.
- The admin token and cron secret are throwaway values in `apps/web/.env.local`. Don't reuse them anywhere.
- Without `RESEND_API_KEY`, `next dev` prints license emails to the server log instead of sending them.
- HTTPS uses a self-signed cert in `apps/web/certificates/` (gitignored). Trust it in Keychain if a client needs a trusted connection.

## Test fixtures

`pnpm licensing:fixtures` writes `tests/fixtures/licensing/fixtures.json` using throwaway keys (kid `test-1`). The private keys are discarded, so nothing secret is committed. Running it again produces new keys and tokens.

## Privacy

The licensing tables store no IPs, device IDs or install counts, and the revocation route logs nothing. Beta signing and simple accept (see `docs/agreements.md`) do store IP address and user agent as evidence. Vercel Web Analytics is not installed in this app; if it's added later, exclude `/api/licenses/*`.
