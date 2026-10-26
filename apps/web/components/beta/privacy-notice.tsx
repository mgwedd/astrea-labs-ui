import Link from 'next/link';

// Applicant privacy notice (spec sections E, H and D2). Retention is pending
// counsel (appendix Q6), so it stays a TODO rather than a made-up period.
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
            <span className="font-medium text-foreground">Your IP address and browser user agent at the moment you
            sign.</span>{' '}
            This is standard e-signature evidence and is captured once, at signing. It&apos;s separate from the app:
            Aletheia itself keeps no logs linking IP addresses to licenses.
          </li>
          <li>
            Our review: the decision, the result and date of our license check, and any notes. If you&apos;re
            approved, your license ID with its issue and expiry dates, and any revocation. We don&apos;t keep the key
            itself.
          </li>
          <li>A record of the emails we send you, so we can limit repeat requests.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground">Why</h3>
        <p>
          To check that you&apos;re a licensed clinician, to keep a signed record of what you were told and agreed to
          before you got a key, to issue and renew your key, and, if you ask, to email you when new versions ship.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground">Who sees it</h3>
        <p>
          Astrea Labs staff only, behind strong authentication. It&apos;s excluded from analytics, and these pages carry no
          third-party trackers: no ad pixels and no session replay. Vercel hosts this site, the signing service and the
          stored documents; Neon hosts the database; Resend sends our email. They act as our service providers. The
          form uses Vercel BotID to check your browser when you submit.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-foreground">How long</h3>
        <p>
          Unsigned drafts are deleted after 7 days. Signed records are never edited; a correction is added as a new
          record.
        </p>
      </div>

      <p>
        Please don&apos;t include any client or patient information anywhere in this application. See the full{' '}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          privacy notice
        </Link>{' '}
        for more.
      </p>
    </section>
  );
}
