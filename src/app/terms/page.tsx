import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = {
  title: "Terms of Service",
  description: "Variota Terms of Service and User Agreement",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      {/* Header */}
      <PageHeader
        showBack={true}
        rightNavigation={
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Privacy Policy
            </Link>
            <Link
              href="/login"
              className="text-[var(--accent-primary)] hover:underline"
            >
              Sign In
            </Link>
          </div>
        }
      />

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 backdrop-blur-sm">
          <div className="prose prose-invert max-w-none">
            <h1 className="mb-8 text-3xl font-bold text-[var(--text-primary)]">
              Terms of Service
            </h1>

            <p className="mb-8 text-[var(--text-secondary)]">
              <strong>Last Updated:</strong> January 1, 2024
            </p>

            <div className="space-y-8 text-[var(--text-secondary)]">
              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  1. Acceptance of Terms
                </h2>
                <p>
                  By accessing and using Variota (&ldquo;Service&rdquo;), you
                  accept and agree to be bound by the terms and provision of
                  this agreement. If you do not agree to abide by the above,
                  please do not use this service.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  2. Description of Service
                </h2>
                <p>
                  Variota is a no-code animation platform that enables users to
                  create dynamic, data-driven video content through a visual
                  programming interface. The &ldquo;Service&rdquo; includes:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Visual node-based programming environment</li>
                  <li>Animation creation and rendering tools</li>
                  <li>Data integration and logic flow capabilities</li>
                  <li>Video export and sharing functionality</li>
                  <li>Workspace management and collaboration features</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  3. User Account and Authentication
                </h2>
                <p>
                  To use certain features of the Service, you must sign in with
                  your Google account. You agree to:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Use only your own Google account for authentication</li>
                  <li>Maintain the security of your Google account</li>
                  <li>
                    Accept responsibility for all activities under your account
                  </li>
                  <li>
                    Notify us immediately of any unauthorized use of your
                    account
                  </li>
                  <li>
                    Comply with Google&apos;s terms of service for your account
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  4. Acceptable Use Policy
                </h2>
                <p>You agree not to use the Service to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>
                    Create content that is illegal, harmful, threatening,
                    abusive, or defamatory
                  </li>
                  <li>
                    Infringe upon the intellectual property rights of others
                  </li>
                  <li>
                    Upload malicious code, viruses, or other harmful technology
                  </li>
                  <li>
                    Attempt to gain unauthorized access to the Service or other
                    accounts
                  </li>
                  <li>
                    Use the Service for commercial purposes without appropriate
                    licensing
                  </li>
                  <li>
                    Create content that violates any applicable laws or
                    regulations
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  5. Intellectual Property Rights
                </h2>
                <h3 className="mb-2 text-lg font-medium text-[var(--text-primary)]">
                  5.1 Your Content
                </h3>
                <p>
                  You retain ownership of all content you create using the
                  Service. By using the Service, you grant us a limited,
                  non-exclusive license to process, store, and display your
                  content solely for the purpose of providing the Service.
                </p>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  5.2 Our Platform
                </h3>
                <p>
                  The Service, including its software, design, text, graphics,
                  and other content, is owned by Variota and is protected by
                  intellectual property laws. You may not copy, modify,
                  distribute, or create derivative works without our express
                  written permission.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  6. Privacy and Data Protection
                </h2>
                <p>
                  Your privacy is important to us. Our Privacy Policy explains
                  how we collect, use, and protect your information when you use
                  the Service. By using the Service, you agree to the collection
                  and use of information in accordance with our Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  7. Subscription and Payment Terms
                </h2>
                <h3 className="mb-2 text-lg font-medium text-[var(--text-primary)]">
                  7.1 Free and Paid Plans
                </h3>
                <p>
                  Variota offers both free and paid subscription plans. Free
                  plans have limitations on features and usage. Paid plans
                  provide additional features and higher usage limits.
                </p>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  7.2 Billing and Cancellation
                </h3>
                <p>
                  Paid subscriptions are billed in advance and will
                  automatically renew unless cancelled. You may cancel your
                  subscription at any time through your account settings.
                  Refunds are provided according to our refund policy.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  8. Service Availability and Modifications
                </h2>
                <p>
                  We strive to maintain the availability of the Service but
                  cannot guarantee uninterrupted access. We reserve the right to
                  modify, suspend, or discontinue the Service at any time with
                  reasonable notice.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  9. Limitation of Liability
                </h2>
                <p>
                  To the maximum extent permitted by law, Variota shall not be
                  liable for any indirect, incidental, special, consequential,
                  or punitive damages, including without limitation, loss of
                  profits, data, use, goodwill, or other intangible losses
                  resulting from your use of the Service.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  10. Indemnification
                </h2>
                <p>
                  You agree to defend, indemnify, and hold harmless Variota
                  from and against any claims, liabilities, damages, losses, and
                  expenses arising out of or in any way connected with your use
                  of the Service or violation of these Terms.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  11. Termination
                </h2>
                <p>
                  We may terminate or suspend your account and access to the
                  Service immediately, without prior notice, for conduct that we
                  believe violates these Terms or is harmful to other users, us,
                  or third parties.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  12. Governing Law and Dispute Resolution
                </h2>
                <p>
                  These Terms shall be governed by and construed in accordance
                  with the laws of [Jurisdiction]. Any disputes arising under
                  these Terms shall be resolved through binding arbitration in
                  accordance with the rules of [Arbitration Organization].
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  13. Changes to Terms
                </h2>
                <p>
                  We reserve the right to modify these Terms at any time. We
                  will notify users of significant changes via email or through
                  the Service. Continued use of the Service after such
                  modifications constitutes acceptance of the updated Terms.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  14. Contact Information
                </h2>
                <p>
                  If you have any questions about these Terms, please contact us
                  at:
                </p>
                <div className="mt-2">
                  <p>
                    <strong>Email:</strong> legal@variota.com
                  </p>
                  <p>
                    <strong>Address:</strong> [Company Address]
                  </p>
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  15. Severability
                </h2>
                <p>
                  If any provision of these Terms is found to be unenforceable
                  or invalid, that provision will be limited or eliminated to
                  the minimum extent necessary so that these Terms will
                  otherwise remain in full force and effect.
                </p>
              </section>
            </div>

            <div className="mt-12 border-t border-[var(--border-primary)] pt-8">
              <p className="text-sm text-[var(--text-tertiary)]">
                These Terms of Service are effective as of the last updated date
                and replace any prior agreements. For questions or concerns,
                please contact our legal team at legal@variota.com.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <Link
            href="/privacy"
            className="flex items-center gap-2 text-[var(--accent-primary)] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Privacy Policy
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 text-[var(--accent-primary)] hover:underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
