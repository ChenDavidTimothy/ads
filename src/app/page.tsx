import Link from 'next/link';
import { redirect } from 'next/navigation';
import Script from 'next/script';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Globe2,
  LineChart,
  Play,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';

import Logo from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HydrateClient, api } from '@/trpc/server';
import { createClient } from '@/utils/supabase/server';
import type { User } from '@supabase/supabase-js';

import { EarlyAccessForm } from './_components/early-access-form';
import { SubscribeForm } from './_components/subscribe-form';
import {
  microBenefits,
  personaWins,
  problemPoints,
  howItWorksSteps,
  capabilityGroups,
  brandSafetyPoints,
  outcomes,
  useCases,
  audiences,
  comparisonPoints,
  integrationsToday,
  integrationsRoadmap,
  pilotHighlights,
  faqs,
  accessibilityNotes,
} from './landing.content';

// Cache public traffic for 60 seconds while preserving auth redirects
export const revalidate = 60;

// SEO metadata for search engines and social sharing
export const metadata = {
  title: 'Variota — Data‑driven creative with no‑code rules at scale',
  description:
    'Turn product data and rules into on‑brand images and video. Batch-generate thousands of variants with governance and localization.',
  openGraph: {
    title: 'Variota',
    description: 'Data‑driven creative with no‑code, node‑based rules — at scale.',
    url: 'https://variota.com/',
    siteName: 'Variota',
    images: [{ url: 'https://variota.com/og.jpg', width: 1200, height: 630 }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Variota',
    description: 'Data‑driven creative with no‑code, node‑based rules — at scale.',
    images: ['https://variota.com/og.jpg'],
  },
  alternates: { canonical: 'https://variota.com/' },
};

export default async function LandingPage() {
  // Optimize Supabase auth call with timeout guard
  let user: User | null = null;
  try {
    const supabase = await createClient();
    const authPromise = supabase.auth.getUser();

    // Add 3-second timeout to prevent slow auth from blocking the page
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Auth timeout')), 3000)
    );

    const result = await Promise.race([authPromise, timeoutPromise]);
    const { data } = result as { data: { user: User | null } };
    user = data.user ?? null;
  } catch (error) {
    // Auth failed or timed out - continue with anonymous user
    console.warn(
      'Auth check failed or timed out:',
      error instanceof Error ? error.message : String(error)
    );
  }

  if (user) {
    redirect('/dashboard');
  }

  // Guard TRPC call to prevent blocking if it fails
  let hello = null;
  try {
    hello = await api.post.hello({ text: 'from Variota' });
  } catch (error) {
    console.warn('TRPC hello call failed:', error instanceof Error ? error.message : String(error));
  }

  return (
    <HydrateClient>
      {/* Structured data for SEO */}
      <Script type="application/ld+json" id="organization-jsonld">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Variota',
          url: 'https://variota.com',
          logo: 'https://variota.com/logo.png',
          sameAs: ['https://www.linkedin.com/company/variota'],
        })}
      </Script>
      <Script type="application/ld+json" id="website-jsonld">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Variota',
          url: 'https://variota.com',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://variota.com/?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        })}
      </Script>

      <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
        <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--surface-1)]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-3" aria-label="Variota home">
              <Logo className="h-14 w-52" />
            </Link>

            <nav aria-label="Primary" className="hidden items-center gap-8 text-sm md:flex">
              <Link
                href="#product"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Product
              </Link>
              <Link
                href="#how-it-works"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                How It Works
              </Link>
              <Link
                href="#use-cases"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Use Cases
              </Link>
              <Link
                href="#pilot"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Pilot
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden md:inline-flex">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="#early-access">
                <Button variant="primary" size="sm">
                  Request Early Access
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main>
          <section className="relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
              <div className="grid gap-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
                <div>
                  <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
                    Data‑driven creative with no‑code, node‑based rules - at scale
                  </h1>
                  <p className="mt-6 max-w-2xl text-lg text-[var(--text-secondary)] sm:text-xl">
                    Build visual rules for prices, discounts, markets, and inventory that trigger
                    badges, layouts, motion, and copy. Batch‑generate thousands of image and video
                    variants.
                  </p>
                  <ul className="mt-6 space-y-2 text-sm text-[var(--text-tertiary)]">
                    <li>
                      • If discount ≥ 20% → show red &quot;Save &#123;discount&#125;%&quot; badge
                      across all eligible SKUs
                    </li>
                    <li>
                      • If market = FR → use EUR, comma decimal, and French legal copy across French
                      variants
                    </li>
                    <li>
                      • If inventory &lt; threshold → switch to &quot;Limited stock&quot; layout
                      with pulse for those products
                    </li>
                  </ul>

                  <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Link href="#pilot">
                      <Button variant="primary" size="lg" className="w-full sm:w-auto">
                        Apply for Pilot
                        <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                      </Button>
                    </Link>
                    <Link href="#demo" className="w-full sm:w-auto">
                      <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                        <Play className="mr-2 h-5 w-5" aria-hidden="true" /> See the workflow
                      </Button>
                    </Link>
                  </div>

                  <ul className="mt-12 grid gap-4 sm:grid-cols-2">
                    {microBenefits.map((benefit) => (
                      <li
                        key={benefit}
                        className="flex items-start gap-3 text-sm text-[var(--text-secondary)]"
                      >
                        <CheckCircle2
                          className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--accent-primary)]"
                          aria-hidden="true"
                        />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <figure className="glass-panel shadow-glass-lg relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--glass-border)] p-8">
                  <div
                    className="flex h-64 items-center justify-center text-[var(--text-tertiary)]"
                    role="img"
                    aria-label="Placeholder for visual rule builder demo showing data sources connecting to node graph and variants grid"
                  >
                    {/* [PLACEHOLDER VISUAL: Data sources (Sheet/API/CSV) → Node graph (conditions/actions) → Variants grid] */}
                    <div className="text-center">
                      <Database
                        className="mx-auto mb-4 h-16 w-16 text-[var(--accent-primary)]"
                        aria-hidden="true"
                      />
                      <p className="text-lg font-medium">Data → Node Rules → Variants</p>
                      <p className="mt-2 text-sm">Coming soon: Visual rule builder demo</p>
                    </div>
                  </div>
                  <figcaption className="mt-6 text-sm text-[var(--text-tertiary)]">
                    Data sources (Sheet/API/CSV) → Node graph (conditions/actions) → Variants grid.
                    Build rules visually with drag-and-drop nodes for conditions that trigger
                    creative changes.
                  </figcaption>
                </figure>
              </div>
            </div>
          </section>

          <section className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/90">
            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12 text-center text-sm text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-center sm:text-base">
              <span className="font-medium text-[var(--text-primary)]">
                Now recruiting 3–5 pilot partners in promo-heavy retail. We&apos;ll prep your
                CSV/Sheet for you.
              </span>
            </div>
          </section>

          <section id="product" className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
            <div className="mb-12 max-w-3xl">
              <h2 className="scroll-mt-24 text-3xl font-bold sm:text-4xl">
                Benefits for every team - without adding headcount
              </h2>
              <p className="mt-4 text-lg text-[var(--text-secondary)]">
                Variota gives marketing and merchandising teams a simple way to turn product data
                into on‑brand creative at scale - without waiting on production.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {personaWins.map((persona) => (
                <Card key={persona.title} variant="glass" className="h-full p-6">
                  <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                    {persona.title}
                  </h3>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">{persona.description}</p>
                </Card>
              ))}
            </div>
          </section>

          <section className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/80">
            <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-bold sm:text-4xl">
                  &quot;Manual production can&apos;t keep up with modern promo cycles&quot;
                </h2>
              </div>
              <ul className="mt-10 grid gap-4 text-sm text-[var(--text-secondary)] md:grid-cols-2">
                {problemPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <ArrowRight
                      className="mt-1 h-4 w-4 text-[var(--accent-secondary)]"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-10 max-w-2xl text-base text-[var(--text-secondary)]">
                Teams need a logic-first engine that connects data to creative. Fast, consistent,
                and non-technical.
              </p>
            </div>
          </section>

          <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
            <div className="max-w-3xl">
              <h2 className="scroll-mt-24 text-3xl font-bold sm:text-4xl">How Variota works</h2>
              <p className="mt-4 text-lg text-[var(--text-secondary)]">
                A five-step workflow that keeps marketing, merchandising, and creative teams in
                lockstep.
              </p>
            </div>
            <div className="mt-14 grid gap-6 lg:grid-cols-5">
              {howItWorksSteps.map((step, index) => (
                <Card key={step.title} variant="glass" className="flex h-full flex-col p-6">
                  <span className="text-sm font-medium text-[var(--accent-secondary)]">
                    Step {index + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">{step.description}</p>
                </Card>
              ))}
            </div>
            <div className="mt-12">
              {/* [PLACEHOLDER: HOW-IT-WORKS GIF - CSV upload → column mapping → rules → variants preview] */}
              <div
                className="flex h-64 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-primary)] bg-[var(--surface-2)]/50"
                role="img"
                aria-label="Placeholder for interactive workflow preview showing CSV upload, column mapping, rules setup, and variants preview"
              >
                <div className="text-center text-[var(--text-tertiary)]">
                  <Play
                    className="mx-auto mb-4 h-12 w-12 text-[var(--accent-primary)]"
                    aria-hidden="true"
                  />
                  <p className="text-lg font-medium">Interactive workflow preview</p>
                  <p className="mt-2 text-sm">Coming soon: Step-by-step visual guide</p>
                </div>
              </div>
            </div>
            <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="#demo">
                <Button variant="primary" size="md">
                  See the workflow
                  <Play className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <p className="text-sm text-[var(--text-tertiary)]">
                Prefer a live walkthrough? Request a 15‑min session via the early access form.
              </p>
            </div>
          </section>

          <section
            id="capabilities"
            className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/80"
          >
            <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
              <div className="max-w-3xl">
                <h2 className="scroll-mt-24 text-3xl font-bold sm:text-4xl">Capabilities</h2>
                <p className="mt-4 text-lg text-[var(--text-secondary)]">
                  Governed creative automation that brings data, logic, and production together.
                </p>
              </div>
              <div className="mt-12 grid gap-8 lg:grid-cols-2">
                {capabilityGroups.map((group) => (
                  <Card key={group.title} variant="glass" className="p-6">
                    <div className="flex items-center gap-3">
                      {group.title === 'Data & Logic' && (
                        <Database
                          className="h-5 w-5 text-[var(--accent-primary)]"
                          aria-hidden="true"
                        />
                      )}
                      {group.title === 'Creative Generation' && (
                        <Sparkles
                          className="h-5 w-5 text-[var(--node-animation)]"
                          aria-hidden="true"
                        />
                      )}
                      {group.title === 'Brand & Compliance' && (
                        <ShieldCheck
                          className="h-5 w-5 text-[var(--accent-success)]"
                          aria-hidden="true"
                        />
                      )}
                      {group.title === 'Workflow & Delivery' && (
                        <Workflow
                          className="h-5 w-5 text-[var(--accent-secondary)]"
                          aria-hidden="true"
                        />
                      )}
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                        {group.title}
                      </h3>
                    </div>
                    <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                      {group.items.map((item) => (
                        <li key={item.text} className="flex items-start gap-3">
                          <CheckCircle2
                            className="mt-1 h-4 w-4 text-[var(--accent-primary)]"
                            aria-hidden="true"
                          />
                          <span>
                            {item.text}
                            {item.chip && (
                              <span className="ml-2 inline-block rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                                {item.chip}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold sm:text-4xl">Protect your brand at scale</h2>
              <p className="mt-4 text-lg text-[var(--text-secondary)]">
                Governance, compliance, and localization are first-class citizens across the Variota
                workflow.
              </p>
            </div>
            <ul className="mt-10 space-y-4 text-sm text-[var(--text-secondary)]">
              {brandSafetyPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <ShieldCheck
                    className="mt-0.5 h-5 w-5 text-[var(--accent-success)]"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/80">
            <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-bold sm:text-4xl">
                  Ship more promotions faster - without sacrificing brand control
                </h2>
              </div>
              <ul className="mt-10 grid gap-4 text-sm text-[var(--text-secondary)] md:grid-cols-2">
                {outcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-3">
                    <LineChart
                      className="mt-0.5 h-5 w-5 text-[var(--accent-secondary)]"
                      aria-hidden="true"
                    />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="use-cases" className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
            <div className="grid gap-16 lg:grid-cols-2">
              <div>
                <h2 className="scroll-mt-24 text-3xl font-bold sm:text-4xl">
                  Where Variota shines
                </h2>
                <ul className="mt-8 space-y-4 text-sm text-[var(--text-secondary)]">
                  {useCases.map((useCase) => (
                    <li key={useCase} className="flex items-start gap-3">
                      <Sparkles
                        className="mt-0.5 h-5 w-5 text-[var(--node-animation)]"
                        aria-hidden="true"
                      />
                      <span>{useCase}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-[var(--text-primary)]">Who it’s for</h3>
                <ul className="mt-8 space-y-4 text-sm text-[var(--text-secondary)]">
                  {audiences.map((audience) => (
                    <li key={audience} className="flex items-start gap-3">
                      <Globe2
                        className="mt-0.5 h-5 w-5 text-[var(--accent-primary)]"
                        aria-hidden="true"
                      />
                      <span>{audience}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/85">
            <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-bold sm:text-4xl">Why Variota vs. alternatives?</h2>
              </div>
              <div className="mt-12 grid gap-6 md:grid-cols-3">
                {comparisonPoints.map((comparison) => (
                  <Card key={comparison.title} variant="glass" className="h-full p-6">
                    <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                      {comparison.title}
                    </h3>
                    <p className="mt-4 text-sm text-[var(--text-secondary)]">
                      {comparison.description}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold sm:text-4xl">
                  Connect to your data and channels
                </h2>
                <p className="mt-4 text-lg text-[var(--text-secondary)]">
                  Bring Variota into your existing merchandising and creative stack. Tell us which
                  integrations matter most during the pilot.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Card variant="glass" className="p-6">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    In pilot now
                    <span className="ml-2 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                      Private beta
                    </span>
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                    {integrationsToday.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2
                          className="mt-1 h-4 w-4 text-[var(--accent-primary)]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card variant="glass" className="p-6">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    On the roadmap
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                    {integrationsRoadmap.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <ArrowRight
                          className="mt-1 h-4 w-4 text-[var(--accent-secondary)]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          </section>

          <section
            id="pilot"
            className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/80"
          >
            <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
              <div className="max-w-3xl">
                <h2 className="scroll-mt-24 text-3xl font-bold sm:text-4xl">Join the pilot</h2>
                <p className="mt-4 text-lg text-[var(--text-secondary)]">{pilotHighlights.intro}</p>
              </div>
              <div className="mt-10 grid gap-6 md:grid-cols-2">
                <Card variant="glass" className="p-6">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Ideal partners
                  </h3>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    {pilotHighlights.profile}
                  </p>
                </Card>
                <Card variant="glass" className="p-6">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    What we provide
                  </h3>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    {pilotHighlights.provide}
                  </p>
                </Card>
                <Card variant="glass" className="p-6 md:col-span-2">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">What we ask</h3>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">{pilotHighlights.ask}</p>
                </Card>
              </div>
              <div className="mt-6 text-center">
                <p className="text-sm text-[var(--text-secondary)]">{pilotHighlights.incentives}</p>
              </div>
              <div className="mt-10">
                <Link href="#early-access">
                  <Button variant="primary" size="md">
                    Apply for Pilot
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          <section id="demo" className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
            <div id="early-access" className="-mt-24 h-24 sm:-mt-32 sm:h-32" aria-hidden="true" />
            <div className="space-y-12">
              <div className="grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
                <div>
                  <h2 className="scroll-mt-24 text-3xl font-bold sm:text-4xl">
                    See Variota in action
                  </h2>
                  <p className="mt-4 text-lg text-[var(--text-secondary)]">
                    Watch a 2-minute walkthrough of importing data, setting rules, and generating
                    variants. Prefer live? Book a 15-minute session below.
                  </p>
                  <p className="mt-6 text-sm text-[var(--text-tertiary)]">
                    We’ll reply within 2 business days.
                  </p>
                </div>
                <Card variant="glass" className="overflow-hidden p-0">
                  <div className="aspect-video w-full">
                    {/* [PLACEHOLDER: EMBEDDED VIDEO - use an iframe] */}
                    <div
                      className="flex h-full items-center justify-center bg-[var(--surface-2)] text-[var(--text-tertiary)]"
                      role="img"
                      aria-label="Placeholder for 2-minute demo video showing Variota workflow walkthrough"
                    >
                      <div className="text-center">
                        <Play
                          className="mx-auto mb-4 h-16 w-16 text-[var(--accent-primary)]"
                          aria-hidden="true"
                        />
                        <p className="text-lg font-medium">2-minute demo video</p>
                        <p className="mt-2 text-sm">Coming soon: Live walkthrough</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              <Card variant="glass" className="p-6">
                <EarlyAccessForm />
              </Card>
            </div>
          </section>

          <section id="faq" className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
            <div className="max-w-3xl">
              <h2 className="scroll-mt-24 text-3xl font-bold sm:text-4xl">FAQ</h2>
            </div>
            <div className="mt-10 space-y-6">
              {faqs.map((faq) => (
                <Card key={faq.question} variant="glass" className="p-6">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {faq.question}
                  </h3>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">{faq.answer}</p>
                </Card>
              ))}
            </div>
          </section>

          <section
            id="accessibility"
            className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/80"
          >
            <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
              <div className="max-w-3xl">
                <h2 className="scroll-mt-24 text-3xl font-bold sm:text-4xl">
                  Accessibility, performance, and security
                </h2>
                <p className="mt-4 text-lg text-[var(--text-secondary)]">
                  Built for enterprise standards with inclusive design and resilient infrastructure.
                </p>
              </div>
              <div className="mt-12 grid gap-6 md:grid-cols-3">
                <Card variant="glass" className="p-6">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Accessibility
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                    {accessibilityNotes.accessibility.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2
                          className="mt-1 h-4 w-4 text-[var(--accent-primary)]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card variant="glass" className="p-6">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Performance</h3>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                    {accessibilityNotes.performance.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2
                          className="mt-1 h-4 w-4 text-[var(--accent-primary)]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card variant="glass" className="p-6">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Security & privacy
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                    {accessibilityNotes.security.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2
                          className="mt-1 h-4 w-4 text-[var(--accent-primary)]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
            <div className="shadow-glass-lg rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--surface-1)]/80 p-10 text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">Apply for pilot access</h2>
              <p className="mt-4 text-lg text-[var(--text-secondary)]">
                Ready to connect your product data to governed creative automation? Share your
                context and we&apos;ll align on a pilot path.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="#early-access" className="inline-flex">
                  <Button variant="primary" size="lg">
                    Apply for Pilot
                    <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                  </Button>
                </Link>
                <Link href="mailto:hello@variota.com" className="inline-flex">
                  <Button variant="secondary" size="lg">
                    Talk with our team
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-sm text-[var(--text-tertiary)]">
                {hello?.greeting ?? 'Welcome to the future of data-driven creative automation.'}
              </p>
            </div>
          </section>
        </main>

        <footer className="border-t border-[var(--border-primary)] bg-[var(--surface-1)]/90">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div>
                <Link href="/" className="flex items-center gap-3" aria-label="Variota logo">
                  <Logo className="h-12 w-48" />
                </Link>
                <p className="mt-4 max-w-md text-sm text-[var(--text-secondary)]">
                  Variota turns product data and business rules into professional images and videos
                  at scale. Subscribe for updates or request early access.
                </p>
                <div className="mt-6 max-w-sm">
                  <SubscribeForm />
                </div>
              </div>
              <div className="grid gap-10 sm:grid-cols-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-[var(--text-tertiary)] uppercase">
                    Navigate
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                    <li>
                      <Link href="#product" className="hover:text-[var(--text-primary)]">
                        Product
                      </Link>
                    </li>
                    <li>
                      <Link href="#how-it-works" className="hover:text-[var(--text-primary)]">
                        How It Works
                      </Link>
                    </li>
                    <li>
                      <Link href="#use-cases" className="hover:text-[var(--text-primary)]">
                        Use Cases
                      </Link>
                    </li>
                    <li>
                      <Link href="#pilot" className="hover:text-[var(--text-primary)]">
                        Pilot
                      </Link>
                    </li>
                    <li>
                      <Link href="/investors" className="hover:text-[var(--text-primary)]">
                        Investors
                      </Link>
                    </li>
                    <li>
                      <Link href="/login" className="hover:text-[var(--text-primary)]">
                        Sign In
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-[var(--text-tertiary)] uppercase">
                    Company
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                    <li>
                      <Link href="#product" className="hover:text-[var(--text-primary)]">
                        About
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="mailto:hello@variota.com"
                        className="hover:text-[var(--text-primary)]"
                      >
                        Contact
                      </Link>
                    </li>
                    <li>
                      <Link href="/investors" className="hover:text-[var(--text-primary)]">
                        Investors
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-[var(--text-tertiary)] uppercase">
                    Legal & social
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                    <li>
                      <Link href="/privacy" className="hover:text-[var(--text-primary)]">
                        Privacy Policy
                      </Link>
                    </li>
                    <li>
                      <Link href="/terms" className="hover:text-[var(--text-primary)]">
                        Terms of Service
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="https://www.linkedin.com"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-[var(--text-primary)]"
                      >
                        LinkedIn
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="mailto:hello@variota.com"
                        className="hover:text-[var(--text-primary)]"
                      >
                        Email us
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--border-primary)] pt-6 text-xs text-[var(--text-tertiary)] sm:flex-row">
              <p>&copy; {new Date().getFullYear()} Variota. All rights reserved.</p>
              <Link href="#early-access" className="inline-flex">
                <Button variant="primary" size="sm">
                  Request Early Access
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </HydrateClient>
  );
}
