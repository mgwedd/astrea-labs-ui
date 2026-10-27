# Launch setup: things only you can approve

Each step creates a paid or production resource, so it needs you. Set every value in
Vercel (Project `astrea-labs-ui` → Settings → Environment Variables), mark secrets
**Sensitive**, and never paste them into chat or commit them. Dashboard menu names
may differ slightly from what's written here.

## 1. Private Blob store (signed PDFs and audit JSON)

1. Vercel dashboard → Storage → Create → Blob. Choose **Private** access.
2. Connect it to the project for Production and Preview.
3. Connecting sets `BLOB_READ_WRITE_TOKEN` (or the OIDC `BLOB_STORE_ID`) for you. Check it
   appears under Environment Variables.

Local dev needs nothing: files go to `apps/web/.blob-local/`.

## 2. KMS issuer for the document seal (`SEAL_KMS_ISSUER_ID`)

This key seals signed PDFs. It must be separate from the license-signing key.

1. Vercel dashboard → KMS → create an issuer for this project, with a signing key.
2. Activate the key and allow the project's Production environment to sign with it
   (OIDC, no secret to copy).
3. Set `SEAL_KMS_ISSUER_ID` to the issuer id for Production (and Preview if previews
   should make verifiable seals).

Without it, production refuses to seal; dev and preview use a throwaway key whose seals
can't be verified later.

## 3. GitHub App for feedback issues

1. GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.
   - Webhook: off.
   - Repository permissions: **Issues: Read and write**. Metadata: read-only (default).
     Nothing else.
2. Create it, note the App ID, and generate a private key (a `.pem` file downloads).
3. Install the app on these repos only:
   - `mgwedd/aletheia`, `mgwedd/astrea-sda-api`, `mgwedd/eido`
   - `KingMoonk/TRAINER`: this account is not yours, so its owner has to approve the install.
4. Set in Vercel:
   - `GITHUB_APP_ID`: the App ID.
   - `GITHUB_APP_PRIVATE_KEY`: the full PEM contents (`\n` escapes are fine). Sensitive.
   - `GITHUB_TOKEN` (optional): a fine-grained read-only token, only to raise the rate
     limit for reading releases.
5. Delete the downloaded `.pem` from your machine once it is stored.

## 4. Firewall rate limit on public form POSTs

The project has no firewall config yet, and my attempt to create one was blocked, so add
this by hand: Project → Firewall → Configure → New Rule.

- Name: `Rate limit public form POSTs`
- If **Request Method** equals `POST`
- and **Request Path** matches regex
  `^/api/(agreements/accept|account/(invite|join)|beta/(apply|key|resume|sign|sign/open)|feedback|feedback/confirm|licenses/request)/?$`
- Then **Rate Limit**: fixed window, 60 seconds, 10 requests, keyed by IP, action **Deny**.
- Save, then Publish.

The app keeps its own per-email limits as well; this rule stops one IP flooding the forms.

## 5. Admin sign-in (Auth0)

`/admin` is gated by Auth0 (`@auth0/nextjs-auth0` v4) and an email allowlist. Env var names (set in `.env.local` locally; in Vercel for production, secrets Sensitive):

- `APP_BASE_URL`: the site origin, e.g. `http://localhost:3000` locally, `https://astrealabs.com` in production.
- `AUTH0_DOMAIN`: the tenant domain (no scheme).
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SECRET`: random 32-byte hex string that encrypts the session cookie (`openssl rand -hex 32`).
- `ADMIN_EMAILS`: comma-separated emails allowed into `/admin`. The email must also be verified in Auth0.

In the Auth0 application, add the production URLs next to the localhost ones:

- Allowed Callback URLs: `https://astrealabs.com/auth/callback`
- Allowed Logout URLs: `https://astrealabs.com/`

The allowlist is the gate for `/admin`. Sign-ups are off (see section 6), so only invited users exist.

## 6. User accounts (invite-only, passwordless)

Accounts are optional. A visitor is offered one only after submitting a beta application (the license request) and confirming their email; the emailed link is single use and expires in 7 days. The link opens `/account/join`, whose button creates the user for that email through the Management API, in advance, on the passwordless email connection. They then sign in with a one-time code emailed to them. There are no passwords. Sign-up is off on every connection, so there is no other way to create an account. Roles come from the verified email: any verified user is `user`, and `ADMIN_EMAILS` members are also `admin` (`lib/auth/roles.ts`). Admins may use the same connection, but only if their user already exists there; the allowlist check is unchanged.

Why a one-time code and not a magic link: a link is consumed by email scanners that pre-fetch it and only works in the browser that asked for it. A code works from any device and survives scanners.

Why the Management API and not the SDK's sign-up: `@auth0/nextjs-auth0` only starts Universal Login, which would need sign-ups on. The official `auth0` Node SDK's `ManagementClient` creates the user server-side, so no OAuth is hand-rolled.

Extra env vars (Vercel, Sensitive; `.env.local` locally):

- `AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET`: the machine-to-machine app below. Copy the secret from the Auth0 Dashboard (Applications > the M2M app > Settings); the CLI never prints it.
- `AUTH0_PASSWORDLESS_CONNECTION`: name of the email connection, `email`.

Tenant setup, with the Auth0 CLI (`auth0 login` first). Files are in `apps/web/docs/auth0/`. Do these in order:

1. M2M app: `auth0 apps create --name "Astrea Labs Accounts (M2M)" --type m2m --description "Creates invited users" --no-input`
2. Grant it the minimum Management API scopes (`read:users`, `create:users`): `auth0 api post client-grants --data '{"client_id":"<M2M client id>","audience":"https://<AUTH0_DOMAIN>/api/v2/","scope":["read:users","create:users"]}'`. If the grant already has `create:user_tickets`, remove it: `auth0 api patch client-grants/<grant id> --data '{"scope":["read:users","create:users"]}'`
3. Passwordless email connection, sign-up off: `auth0 api post connections --data @docs/auth0/email-connection.json`. The `from` address must be on a Resend-verified domain (see Resend below).
4. Enable it for this site's app only: `auth0 api patch connections/<connection id>/clients --data '[{"client_id":"<web app client id>","status":true}]'`
5. Turn off sign-ups on the database connection. `options` is replaced as a whole on update, so read it, set `disable_signup` to `true` and `authentication_methods.password.signup_behavior` to `"block"`, and send it all back: `auth0 api get connections/<connection id>`, then `auth0 api patch connections/<connection id> --data '{"options":{...existing options..., "disable_signup":true, ...}}'`
6. Pre-user-registration Action (defense in depth; denies any user not created by our invite flow, on any connection): `auth0 api post actions/actions --data '{"name":"invite-only-signup","supported_triggers":[{"id":"pre-user-registration","version":"v2"}],"runtime":"node22","code":"exports.onExecutePreUserRegistration = async (event, api) => { if (event.user.app_metadata && event.user.app_metadata.invited === true) return; api.access.deny(\"invite_only\", \"Sign-ups are by invitation.\"); };"}'`, then `auth0 api post actions/actions/<action id>/deploy`, then bind it: `auth0 api patch actions/triggers/pre-user-registration/bindings --data '{"bindings":[{"ref":{"type":"action_id","value":"<action id>"},"display_name":"invite-only-signup"}]}'`. If invites start failing with `invite_only`, unbind it and check that Auth0 passes `app_metadata` to this trigger for Management API creates.
7. Universal Login theme (light only; Auth0 themes are single-mode, so dark mode is a follow-up that needs a page template and a custom domain): `auth0 api post branding/themes --data @docs/auth0/theme.json`. The logo is `https://astrealabs.com/icon.svg`. The theme sets no custom font.
8. Dark theme (the user wants dark if only one mode). Themes are single-mode, so the tenant default theme was switched to dark with the slate tokens (no widget shadow): `auth0 api patch branding/themes/<themeId> --data @docs/auth0/theme-dark.json`. `<themeId>` comes from `auth0 api get branding/themes/default`. The site icon is a #020817 square, invisible on the #020817 page, so `public/media/auth-logo.svg` (same shape, #0F172A fill, 1px #1E293B stroke) replaces it. PENDING after merge and deploy: `auth0 api patch branding/themes/<themeId> --data '{"widget":{"logo_url":"https://astrealabs.com/media/auth-logo.svg"}}'`, then set `widget.logo_url` in `theme.json` and `theme-dark.json` to match. Light/dark auto-switching needs either a page template (custom domain required) or ACUL (Enterprise plan and a verified custom domain, plus a CDN for the bundle). Neither was set up; no DNS was changed.
8. Screen text. The login screen: `auth0 api put prompts/login-id/custom-text/en --data '{"login-id":{"title":"Sign in to Astrea Labs","description":"Enter your email and we will send you a one-time code.","buttonText":"Continue","emailPlaceholder":"Email address"}}'`. The code screen: `auth0 api put prompts/login-passwordless/custom-text/en --data @docs/auth0/prompts-email-code.json`. The key names are from memory of Auth0's text-customization schema and unverified; check the result on the hosted page. The login screen also needs the Identifier First + Passwordless authentication profile (Dashboard > Authentication > Authentication Profile).
9. Wrong-code and not-invited messages: set the `invalid-code` text to "That code is incorrect or has expired. Check the code or request a new one." and use "Accounts are by invitation after a license request. Request one at https://astrealabs.com/aletheia/beta/apply" as the Action's deny message. A "Request a license" button needs a page template, which needs a custom domain (a DNS change).

Resend as Auth0's email provider (the passwordless code is sent through it). The API key is a secret: enter it yourself, never paste it into chat. Dashboard > Branding > Email Provider > SMTP: host `smtp.resend.com`, port `465`, username `resend`, password your Resend API key, From the verified sender. Or in your own terminal, so the key is not in shell history: `read -s KEY && auth0 email provider create --provider smtp --smtp-host smtp.resend.com --smtp-port 465 --smtp-user resend --smtp-pass "$KEY" --default-from-address "Astrea Labs <login@astrealabs.com>" --enabled`. Blocker: the sender domain is not verified yet (mgwedd/astrea-labs-ui#6); until it is, codes will not send.

## Already tracked elsewhere

- Email (Resend domain, `RESEND_API_KEY`, `LICENSE_EMAIL_FROM`): mgwedd/astrea-labs-ui#6.
- Launch gate for Aletheia beta signing: mgwedd/astrea-labs-ui#5.
