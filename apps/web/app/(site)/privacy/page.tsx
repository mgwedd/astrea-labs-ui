import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy', description: `How ${site.legalName} handles your data.` };

// TODO(legal): have this reviewed before the beta opens, and fill in retention and contact details.
export default function PrivacyPage() {
  return (
    <div className="container max-w-2xl pb-16">
      <PageHeader eyebrow="Legal" title="Privacy notice" />
      <div className="prose prose-neutral dark:prose-invert">
        <h2>Aletheia beta licenses</h2>
        <p>When you request an Aletheia beta license, {site.legalName} stores:</p>
        <ul>
          <li>your email address;</li>
          <li>whether you asked to be emailed when updates ship;</li>
          <li>your license ID, when it was issued, its end date if it has one, and whether it was revoked;</li>
          <li>when we emailed you a license, so we can limit repeat requests.</li>
        </ul>
        <p>
          We use this only to send your license, renewals and, if you opted in, notices that a new version is out. We send
          email through Resend and host the site and database on Vercel and Neon.
        </p>
        <p>
          We do not collect device IDs, install counts, or IP addresses tied to a license (IP addresses are stored only with agreements, below). Aletheia checks a public
          revocation list that is the same for everyone, so that check does not identify you. Your session recordings,
          transcripts and notes stay on your Mac and are never sent to us.
        </p>
        <p>
          To stop automated sign-ups, the request form uses Vercel BotID, which checks your browser when you submit. Our
          hosting provider keeps standard request logs, including IP addresses, for a short time. We don&apos;t link
          them to licenses.
        </p>
        <h2>Agreements and acceptances</h2>
        <p>
          When you accept or sign an agreement on this site (for example the Aletheia beta agreement), we store your email
          address, the version of the text you saw, when you ticked each box and accepted, your IP address and your
          browser&apos;s user agent, as evidence of what you agreed to and when. Signed agreements also produce a PDF that we
          store privately and email to you. This data is kept in Neon Postgres and Vercel Blob, both hosted on Vercel.
        </p>
      </div>
    </div>
  );
}
