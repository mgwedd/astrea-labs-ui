import Link from 'next/link';
import { DRAFT_RETENTION_DAYS, EMAIL_LOG_RETENTION_DAYS } from '@/lib/beta-access/retention';

// Applicant privacy notice. Every statement here is checked against the code:
// retention in lib/beta-access/retention.ts, analytics in lib/analytics-filter.ts.
export function ApplicantPrivacyNotice() {
  return (
    <section aria-labelledby="privacy-heading" id="privacy" className="flex flex-col gap-5 text-sm text-muted-foreground">
      <h2 id="privacy-heading" className="text-xl font-semibold tracking-tight text-foreground">
        Applicant privacy notice
      </h2>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground">What we keep</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            Your answers: name, professional email, credential, license numbers and states, NPI (if you give it),
            supervisor (if you&apos;re pre-licensed), practice name and setting, the states and formats you see clients
            in, the practice categories you tick, your Mac&apos;s chip and macOS version, and anything you add in the
            free-text boxes.
          </li>
          <li>
            Each disclosure and attestation you were shown or ticked: its text version, a SHA-256 fingerprint of the
            exact wording, and the time you ticked it.
          </li>
          <li>
            Your typed signature, when you confirmed your email, when you signed, and the signed PDF with its audit
            trail.
          </li>
          <li>
            <span className="font-medium text-foreground">Your IP address and browser user agent</span> when you sign,
            and again when you confirm your license at renewal. This is standard e-signature evidence. It&apos;s
            separate from the app: Aletheia itself keeps no logs linking IP addresses to licenses.
          </li>
          <li>
            Our review: the decision, the result and date of our license check, and any notes. If you&apos;re
            approved, your license ID with its issue and expiry dates, and any revocation. We don&apos;t keep the key
            itself, but we can issue a fresh key link for your license.
          </li>
          <li>
            A log of the emails we send you (address, subject, type and time), so we can limit repeat requests and see
            failed sends. Emails that contain a single-use link or your application answers are logged without their content.
          </li>
          <li>
            A session cookie (<code>beta_session</code>) while you sign or open your key link. It is needed for the
            page to work and expires after one to two hours.
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground">Why</h3>
        <p>
          To check that you&apos;re a licensed clinician, to keep a signed record of what you were told and agreed to
          before you got a key, and to issue and renew your key.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground">Who sees it</h3>
        <p>
          Astrea Labs staff only, behind strong authentication. When you sign, we email the reviewer a copy of your
          answers and the consents you ticked so we can decide on your application. These pages are left out of
          analytics and carry no ad pixels or session replay. The rest of this site uses Vercel Web Analytics, which
          doesn&apos;t see these pages or any query string.
        </p>
        <p>
          Service providers process data for us: Vercel hosts this site and stores the signed documents and the keys
          that seal them; Neon hosts the database; Resend sends our email; Auth0 runs the optional account you can
          create after signing; GitHub receives feedback reports you choose to submit. The form uses Vercel BotID to
          check your browser when you submit.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground">How long</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Unsigned drafts are deleted after about {DRAFT_RETENTION_DAYS} days.</li>
          <li>
            Signed applications, our review, license records and the signing evidence are kept for at least the
            term of the license plus six years. If you&apos;re declined, they&apos;re kept for at least six years
            from our decision. Nothing deletes them automatically. The signed documents, review decisions and
            acceptance records are locked in the database against edits and deletion; a correction is added as a new
            record, and we can&apos;t remove them on request during that time.
            We also use the record to check any later application from you.
          </li>
          <li>The email log, including any failed sends, is deleted after about {EMAIL_LOG_RETENTION_DAYS} days. Resend keeps its own log of mail it sends, under its retention policy.</li>
        </ul>
      </div>

      <p>
        Please don&apos;t include any client or patient information anywhere in this application. Questions about your
        record: support@astrealabs.com. See the full{' '}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          privacy notice
        </Link>{' '}
        for more.
      </p>
    </section>
  );
}
