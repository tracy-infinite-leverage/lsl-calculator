import { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/shell/footer';
import { Header } from '@/components/shell/header';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Privacy notice | LSL Calculator',
  description:
    'How the LSL Calculator handles wage data, PDFs, and personal information. Plain-English summary plus the full data-handling policy.',
};

const UPDATED = '23 May 2026';

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <article className="space-y-8">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">
              Privacy
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Privacy notice
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated {UPDATED}. Plain-English summary; the{' '}
              <Link
                href="https://github.com/tracy-infinite-leverage/lsl-calculator/blob/main/docs/engineering/data-handling-policy.md"
                className="underline underline-offset-2"
              >
                full data-handling policy
              </Link>{' '}
              has the detail.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">The short version</h2>
            <ul className="list-disc pl-6 space-y-2 text-foreground">
              <li>
                <strong>Calculations run in your browser.</strong> Wage data you type or paste
                in goes nowhere — it never leaves the device.
              </li>
              <li>
                <strong>CSV uploads stay in your browser.</strong> We don&apos;t send CSV
                contents to any server.
              </li>
              <li>
                <strong>PDF uploads are different.</strong> A PDF goes to our server long
                enough to extract the text, then the text is sent to Anthropic Claude (US) for
                interpretation. The PDF itself is not sent to Anthropic — only the extracted
                text. Anthropic does not use customer data to train its models. They may retain
                request/response data for a limited period (currently up to 30 days) for service
                operation and abuse monitoring per their{' '}
                <a
                  href="https://www.anthropic.com/legal/commercial-terms"
                  className="underline underline-offset-2"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Commercial Terms
                </a>
                .
              </li>
              <li>
                <strong>We don&apos;t store anything server-side.</strong> No database, no
                user accounts, no employee records. Your last result is kept in your own
                browser&apos;s local storage so a refresh doesn&apos;t lose it.
              </li>
              <li>
                <strong>Analytics is cookie-free.</strong> We use Vercel Analytics to count
                page views and broad funnel events (e.g. &ldquo;CSV uploaded&rdquo;,
                &ldquo;calculation finished&rdquo;). No wage numbers, names, dates, or emails
                are recorded in analytics — ever.
              </li>
              <li>
                <strong>Error reports are scrubbed.</strong> If something crashes, the error
                report sent to our hosting provider has all wage values, names, dates, and
                email addresses replaced with{' '}
                <code className="font-mono text-xs">[REDACTED]</code> first.
              </li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What is sent where</h2>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-2">Recipient</th>
                    <th className="text-left p-2">What</th>
                    <th className="text-left p-2">Why</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t align-top">
                    <td className="p-2 font-medium">Our server (Vercel, Sydney region)</td>
                    <td className="p-2">PDF binary you upload (for the PDF-extract route only)</td>
                    <td className="p-2">Server-side text extraction; the binary is held in memory only and discarded after the response.</td>
                  </tr>
                  <tr className="border-t align-top">
                    <td className="p-2 font-medium">Anthropic Claude API (US)</td>
                    <td className="p-2">Extracted PDF text (the words, not the PDF)</td>
                    <td className="p-2">Interpreting wage data so we can populate the calculator&apos;s preview. Anthropic does not train on customer data; standard retention applies (up to 30 days for abuse monitoring).</td>
                  </tr>
                  <tr className="border-t align-top">
                    <td className="p-2 font-medium">Vercel Analytics</td>
                    <td className="p-2">URL of the page, event names + count buckets (no values)</td>
                    <td className="p-2">Measuring usage. Cookie-free; never sees form contents.</td>
                  </tr>
                  <tr className="border-t align-top">
                    <td className="p-2 font-medium">Your own browser</td>
                    <td className="p-2">Calculator state in <code className="font-mono text-xs">localStorage</code></td>
                    <td className="p-2">Keeps your last calculation across refreshes. Click &ldquo;Start over&rdquo; to clear.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Cross-border disclosure</h2>
            <p>
              The Anthropic Claude API runs on US infrastructure. There is no Australian
              inference region available at the time of writing. The PDF text you upload
              transits the Pacific over HTTPS (TLS 1.2 or later) and is processed in the US
              under Anthropic&apos;s standard commercial terms — your data is not used to train
              their models, and standard retention applies (up to 30 days for abuse monitoring).
            </p>
            <p>
              If you&apos;d prefer not to send anything to a US service, use the{' '}
              <strong>CSV upload</strong> or <strong>manual entry</strong> paths instead. Both
              run entirely in your browser.
            </p>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Your rights</h2>
            <p>
              Because we don&apos;t store any of your data server-side, there&apos;s nothing
              for us to delete on request. To remove the calculator state from your machine,
              click <strong>&ldquo;Start over&rdquo;</strong> on either calculator route or
              clear your browser&apos;s site data for this domain.
            </p>
            <p>
              If you believe your data has been mishandled, contact Tracy Angwin at{' '}
              <a
                href="mailto:tracy@austpayroll.com.au"
                className="underline underline-offset-2"
              >
                tracy@austpayroll.com.au
              </a>
              . You may also escalate to the Office of the Australian Information
              Commissioner (
              <a
                href="https://www.oaic.gov.au"
                className="underline underline-offset-2"
                rel="noopener noreferrer"
                target="_blank"
              >
                oaic.gov.au
              </a>
              ) if needed.
            </p>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Changes to this notice</h2>
            <p>
              We may update this notice as the product evolves (e.g. when additional state rule
              sets ship). Material changes will be noted at the top of this
              page and in the{' '}
              <Link
                href="https://github.com/tracy-infinite-leverage/lsl-calculator/commits/main/docs/engineering/data-handling-policy.md"
                className="underline underline-offset-2"
              >
                policy revision log
              </Link>
              .
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
