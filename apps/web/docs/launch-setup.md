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
   - `mgwedd/aletheia`, `mgwedd/ai-math`, `mgwedd/astrea-sda-api`, `mgwedd/eido`
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
  `^/api/(agreements/accept|beta/(apply|key|resume|sign|sign/open)|feedback|feedback/confirm|licenses/request)/?$`
- Then **Rate Limit**: fixed window, 60 seconds, 10 requests, keyed by IP, action **Deny**.
- Save, then Publish.

The app keeps its own per-email limits as well; this rule stops one IP flooding the forms.

## Already tracked elsewhere

- Email (Resend domain, `RESEND_API_KEY`, `LICENSE_EMAIL_FROM`): mgwedd/astrea-labs-ui#6.
- Launch gate for Aletheia beta signing: mgwedd/astrea-labs-ui#5.
