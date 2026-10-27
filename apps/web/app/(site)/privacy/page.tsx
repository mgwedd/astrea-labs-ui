import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { DRAFT_RETENTION_DAYS, EMAIL_LOG_RETENTION_DAYS } from '@/lib/beta-access/retention';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy', description: `How ${site.legalName} handles your data.` };

const CONTACT = 'support@astrealabs.com';

export default function PrivacyPage() {
  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Legal" title="Privacy notice" />
      <div className="prose prose-neutral dark:prose-invert">
        <p>
          This notice covers this website and the Aletheia beta application. The Aletheia app&apos;s own data handling is
          covered by the{' '}
          <Link href="/aletheia/privacy">Aletheia Privacy Policy</Link>. This website never receives patient or client
          data, and you should never send any.
        </p>

        <h2>What we collect</h2>
        <h3>Aletheia beta application and license</h3>
        <ul>
          <li>
            Your application answers: name, professional email, credential, license numbers and states, NPI (if you give
            it), supervisor (if you are pre-licensed), practice details, the practice categories you tick, your
            Mac&apos;s chip and macOS version, and anything you write in the free-text boxes.
          </li>
          <li>
            The disclosures and attestations you were shown: text version, a SHA-256 fingerprint of the wording, and the
            time you ticked each one.
          </li>
          <li>
            Signing evidence: your typed signature, when you confirmed your email and signed, the signed PDF, and your
            IP address and browser user agent at signing and again when you confirm your license at renewal.
          </li>
          <li>
            Our review: the decision, the result and date of our license check, and notes. If you are approved, your
            license ID, its dates and any revocation. We do not store the key itself.
          </li>
          <li>
            A log of the emails we send (address, subject, type and time). Emails that contain a single-use link are
            logged without their content.
          </li>
          <li>
            A session cookie, <code>beta_session</code>, while you sign or open your key link. It lasts one to two hours.
          </li>
        </ul>
        <p>
          When you sign, we email our reviewer a copy of your answers and the consents you ticked, so the application
          can be decided.
        </p>

        <h3>Accounts, feedback and the forum</h3>
        <ul>
          <li>
            Optional account: sign-in runs on Auth0 with a one-time code by email. We store your email, your Auth0 ID
            and your email preferences.
          </li>
          <li>
            Feedback: the email and report you submit. We email you a confirmation link and review each report before it
            is posted as a public GitHub issue. Your email address is not posted.
          </li>
          <li>Forum: members only. We store your posts, votes and reports against your Auth0 ID, not your IP address.</li>
        </ul>

        <h3>Everyone</h3>
        <p>
          Our hosting provider keeps standard request logs, including IP addresses, for a short time. Vercel Web
          Analytics counts page views on this site. It is switched off on the beta application and key pages and on
          admin pages, and it never records query strings. We do not use ad pixels or session replay. Vercel BotID
          checks your browser on forms to stop automated sign-ups.
        </p>

        <h2>Who processes it</h2>
        <ul>
          <li>Vercel: hosting, private file storage for signed documents, the keys that seal them, Web Analytics and BotID.</li>
          <li>Neon: the database.</li>
          <li>Resend: sending email.</li>
          <li>Auth0: optional account sign-in.</li>
          <li>GitHub: feedback reports that you submit and we approve.</li>
        </ul>
        <p>We do not sell your data or use it for advertising.</p>

        <h2>How long we keep it</h2>
        <ul>
          <li>Unsigned applications: deleted after {DRAFT_RETENTION_DAYS} days.</li>
          <li>
            Signed applications, our review, license records and signing evidence: for the term of the license and six
            years after it ends. If an application is declined, for six years from the decision. These records are
            append-only: they are never edited, a correction is added as a new record, and we cannot delete them on
            request during that period.
          </li>
          <li>Email log: deleted after {EMAIL_LOG_RETENTION_DAYS} days.</li>
          <li>
            Feedback you did not confirm: deleted after 7 days. Confirmed reports are kept until we remove them; a
            published GitHub issue stays on GitHub.
          </li>
          <li>Account, email preferences and forum content: until you ask us to delete them.</li>
        </ul>

        <h2>Your rights and contact</h2>
        <p>
          You can ask us for a copy of your data, for corrections, or for deletion of anything not covered by the
          retention period above, and you can unsubscribe from any email. Write to{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </div>
    </div>
  );
}
