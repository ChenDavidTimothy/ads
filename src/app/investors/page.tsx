import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-4xl px-6 py-24 sm:py-32">
        <div className="text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">
            Building the automation layer for retail creative
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)]">
            Retail and e-commerce demand high-velocity, data-driven creative. Manual tools and
            custom-coded pipelines can&apos;t keep pace with multi-region catalogs, compliance, and
            localization. Variota&apos;s no-code, logic-first engine spans images and video with
            governance built in.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
              Early traction
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Pilot pipeline development with promo-heavy retailers, expert endorsements from
              merchandising leaders, and active design partners co-shaping automation workflows.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
              Business model
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Tiered SaaS based on usage, seats, and integrations with enterprise options for
              governance and delivery.
            </p>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <Link href="mailto:invest@variota.com" className="inline-flex">
            <Button variant="primary" size="lg">
              Request investor brief
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">
            <Link href="/" className="hover:text-[var(--text-primary)]">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
