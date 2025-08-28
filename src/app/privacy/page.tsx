import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/ui/logo";

export const metadata = {
  title: "Privacy Policy",
  description: "Batchion Privacy Policy and Data Protection Information",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex cursor-pointer items-center gap-3">
            <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
            <div className="flex items-center gap-3">
              <Logo className="h-8 w-32" />
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/terms"
              className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Terms of Service
            </Link>
            <Link
              href="/login"
              className="text-[var(--accent-primary)] hover:underline"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 backdrop-blur-sm">
          <div className="prose prose-invert max-w-none">
            <h1 className="mb-8 text-3xl font-bold text-[var(--text-primary)]">
              Privacy Policy
            </h1>

            <p className="mb-8 text-[var(--text-secondary)]">
              <strong>Last Updated:</strong> January 1, 2024
            </p>

            <div className="space-y-8 text-[var(--text-secondary)]">
              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  1. Introduction
                </h2>
                <p>
                  Batchion (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
                  &ldquo;us&rdquo;) is committed to protecting your privacy.
                  This Privacy Policy explains how we collect, use, disclose,
                  and safeguard your information when you use our no-code
                  animation platform and services (&ldquo;Service&rdquo;).
                </p>
                <p className="mt-2">
                  Please read this Privacy Policy carefully. If you do not agree
                  with the terms of this Privacy Policy, please do not access
                  the Service.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  2. Information We Collect
                </h2>

                <h3 className="mb-2 text-lg font-medium text-[var(--text-primary)]">
                  2.1 Personal Information
                </h3>
                <p>
                  We may collect personal information that you voluntarily
                  provide to us when you:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Sign in with your Google account</li>
                  <li>Subscribe to our services</li>
                  <li>Contact us for support</li>
                  <li>Participate in surveys or feedback requests</li>
                  <li>Sign up for newsletters or marketing communications</li>
                </ul>
                <p className="mt-2">
                  This information may include your name, email address, phone
                  number, billing information, and any other information you
                  choose to provide.
                </p>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  2.2 Usage Data
                </h3>
                <p>
                  We automatically collect certain information when you use our
                  Service, including:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>
                    Device information (IP address, browser type, operating
                    system)
                  </li>
                  <li>Usage patterns and preferences</li>
                  <li>Log data (access times, pages viewed, features used)</li>
                  <li>Performance data (load times, errors, crashes)</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  2.3 Content Data
                </h3>
                <p>
                  We store and process the content you create using our Service,
                  including:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Animation projects and workspaces</li>
                  <li>Generated videos and assets</li>
                  <li>Data files and integrations</li>
                  <li>Project settings and configurations</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  3. How We Use Your Information
                </h2>
                <p>
                  We use the information we collect for the following purposes:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>
                    <strong>Service Provision:</strong> To provide, maintain,
                    and improve our Service
                  </li>
                  <li>
                    <strong>Account Management:</strong> To create and manage
                    your account and preferences
                  </li>
                  <li>
                    <strong>Communication:</strong> To send important service
                    updates and respond to inquiries
                  </li>
                  <li>
                    <strong>Security:</strong> To protect against fraud, abuse,
                    and security threats
                  </li>
                  <li>
                    <strong>Analytics:</strong> To understand usage patterns and
                    improve user experience
                  </li>
                  <li>
                    <strong>Legal Compliance:</strong> To comply with applicable
                    laws and regulations
                  </li>
                  <li>
                    <strong>Marketing:</strong> To send promotional content
                    (with your consent)
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  4. Information Sharing and Disclosure
                </h2>
                <p>
                  We do not sell, rent, or trade your personal information. We
                  may share your information in the following circumstances:
                </p>

                <h3 className="mb-2 text-lg font-medium text-[var(--text-primary)]">
                  4.1 Service Providers
                </h3>
                <p>
                  We may share information with third-party service providers
                  who help us operate our Service, such as:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Cloud hosting and storage providers</li>
                  <li>Payment processing services</li>
                  <li>Analytics and monitoring tools</li>
                  <li>Customer support platforms</li>
                  <li>Email and communication services</li>
                </ul>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  4.2 Legal Requirements
                </h3>
                <p>
                  We may disclose your information if required by law or in
                  response to:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Legal process or government requests</li>
                  <li>Protection of our rights and property</li>
                  <li>Safety of our users or the public</li>
                  <li>Investigation of fraud or other illegal activities</li>
                </ul>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  4.3 Business Transfers
                </h3>
                <p>
                  In the event of a merger, acquisition, or sale of assets, your
                  information may be transferred as part of the business
                  transaction.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  5. Data Security
                </h2>
                <p>
                  We implement appropriate technical and organizational security
                  measures to protect your information, including:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security assessments and updates</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Monitoring and incident response procedures</li>
                  <li>Employee training on data protection</li>
                </ul>
                <p className="mt-2">
                  However, no method of transmission over the internet or
                  electronic storage is 100% secure. We cannot guarantee
                  absolute security of your information.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  6. Data Retention
                </h2>
                <p>
                  We retain your information for as long as necessary to provide
                  our Service and comply with legal obligations:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>
                    <strong>Account Data:</strong> Retained while your account
                    is active and for a reasonable period after closure
                  </li>
                  <li>
                    <strong>Content Data:</strong> Retained according to your
                    storage plan and deletion requests
                  </li>
                  <li>
                    <strong>Usage Data:</strong> Typically retained for up to 2
                    years for analytics purposes
                  </li>
                  <li>
                    <strong>Legal Data:</strong> Retained as required by
                    applicable laws and regulations
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  7. Your Rights and Choices
                </h2>
                <p>
                  Depending on your location, you may have certain rights
                  regarding your personal information:
                </p>

                <h3 className="mb-2 text-lg font-medium text-[var(--text-primary)]">
                  7.1 Access and Portability
                </h3>
                <p>
                  You can access and download your personal information and
                  content through your account settings.
                </p>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  7.2 Correction and Updates
                </h3>
                <p>
                  You can update your personal information through your account
                  settings or by contacting us.
                </p>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  7.3 Deletion
                </h3>
                <p>
                  You can request deletion of your account and associated data.
                  Some information may be retained for legal compliance.
                </p>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  7.4 Marketing Communications
                </h3>
                <p>
                  You can opt out of marketing communications by using the
                  unsubscribe link in emails or updating your preferences.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  8. Cookies and Tracking Technologies
                </h2>
                <p>
                  We use cookies and similar technologies to enhance your
                  experience:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>
                    <strong>Essential Cookies:</strong> Required for basic
                    Service functionality
                  </li>
                  <li>
                    <strong>Analytics Cookies:</strong> Help us understand how
                    you use our Service
                  </li>
                  <li>
                    <strong>Preference Cookies:</strong> Remember your settings
                    and preferences
                  </li>
                  <li>
                    <strong>Marketing Cookies:</strong> Used for targeted
                    advertising (with consent)
                  </li>
                </ul>
                <p className="mt-2">
                  You can control cookie settings through your browser
                  preferences, but disabling certain cookies may affect Service
                  functionality.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  9. International Data Transfers
                </h2>
                <p>
                  Your information may be transferred to and processed in
                  countries other than your residence. We ensure appropriate
                  safeguards are in place to protect your information,
                  including:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Adequacy decisions by relevant authorities</li>
                  <li>Standard contractual clauses</li>
                  <li>Certification programs and codes of conduct</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  10. Children&apos;s Privacy
                </h2>
                <p>
                  Our Service is not intended for children under 13 years of
                  age. We do not knowingly collect personal information from
                  children under 13. If we learn that we have collected such
                  information, we will take steps to delete it promptly.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  11. Changes to This Privacy Policy
                </h2>
                <p>
                  We may update this Privacy Policy from time to time. We will
                  notify you of any changes by:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Posting the new Privacy Policy on this page</li>
                  <li>Sending an email notification to authenticated users</li>
                  <li>Displaying a prominent notice in the Service</li>
                </ul>
                <p className="mt-2">
                  Changes are effective when posted on this page. Your continued
                  use of the Service after changes constitutes acceptance of the
                  updated Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                  12. Contact Us
                </h2>
                <p>
                  If you have any questions about this Privacy Policy or our
                  data practices, please contact us:
                </p>
                <div className="mt-2">
                  <p>
                    <strong>Email:</strong> privacy@batchion.com
                  </p>
                  <p>
                    <strong>Address:</strong> [Company Address]
                  </p>
                  <p>
                    <strong>Data Protection Officer:</strong> dpo@batchion.com
                  </p>
                </div>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  EU/UK Residents
                </h3>
                <p>
                  If you are located in the European Union or United Kingdom,
                  you have additional rights under GDPR and UK GDPR. You may
                  contact our Data Protection Officer or your local supervisory
                  authority with any concerns.
                </p>

                <h3 className="mt-4 mb-2 text-lg font-medium text-[var(--text-primary)]">
                  California Residents
                </h3>
                <p>
                  If you are a California resident, you have additional rights
                  under the California Consumer Privacy Act (CCPA). Please
                  contact us for more information about exercising these rights.
                </p>
              </section>
            </div>

            <div className="mt-12 border-t border-[var(--border-primary)] pt-8">
              <p className="text-sm text-[var(--text-tertiary)]">
                This Privacy Policy is effective as of the last updated date.
                For questions or concerns about your privacy, please contact our
                privacy team at privacy@batchion.com.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <Link
            href="/terms"
            className="flex items-center gap-2 text-[var(--accent-primary)] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Terms of Service
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
