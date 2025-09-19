import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Globe2,
  Layers,
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

import { EarlyAccessForm } from './_components/early-access-form';
import { SubscribeForm } from './_components/subscribe-form';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  const hello = await api.post.hello({ text: 'from Variota' });

  const microBenefits = [
    'No-code logic for colors, motion, sizes, and layouts tied to your data',
    'Excel/CSV import to localize pricing, assortments, and messaging',
    'Brand-locked templates that keep compliance copy intact',
    'Batch-ready assets for social, marketplaces, in-store, and more',
    'Instant regeneration whenever product data shifts',
  ];

  const personaWins = [
    {
      title: 'Marketing',
      description:
        'Launch promotions faster, react to price swings instantly, and keep every channel aligned without waiting on production.',
    },
    {
      title: 'Creative & Design',
      description:
        'Automate repetitive variants with brand-locked templates so designers focus on storytelling instead of manual versioning.',
    },
    {
      title: 'Merchandising',
      description:
        'Reflect negotiated deals by category or region with a single data import and logic rules anyone can edit.',
    },
    {
      title: 'Ad Ops & Performance',
      description:
        'Generate platform-ready variants for continuous testing and iteration without engineering bottlenecks.',
    },
  ];

  const problemPoints = [
    'Frequent price and assortment changes across regions and channels',
    'Manual tools don’t scale to hundreds or thousands of variants',
    'Custom-coded pipelines require engineers and slow every iteration',
    'Brand inconsistencies and compliance risks under deadline pressure',
    'Rising labor costs and omnichannel demands',
  ];

  const howItWorksSteps = [
    {
      title: 'Import data',
      description:
        'Upload Excel/CSV or connect a sheet. Map price, discount, region, category, color, size, and asset URLs in minutes.',
    },
    {
      title: 'Build logic',
      description:
        'Use a no-code, node-based builder to define rules—like highlighting high-margin items or swapping layouts when inventory is low.',
    },
    {
      title: 'Choose templates',
      description:
        'Start from brand-locked templates with dynamic fields, safe zones, and presets for every channel.',
    },
    {
      title: 'Generate at scale',
      description:
        'Create image and video variants for all SKUs, regions, and channels in one batch run with cloud rendering.',
    },
    {
      title: 'Review and publish',
      description:
        'Preview variants, route for approval, export packages, or deliver through feeds. Regenerate instantly when data changes.',
    },
  ];

  const capabilityGroups = [
    {
      title: 'Data & Logic',
      items: [
        'Excel/CSV import, field mapping, and validation',
        'No-code rules tied to product attributes and thresholds',
        'Conditional animation, styling, and layouts based on data',
        'Regional variants that respect currencies, copy, and disclosures',
      ],
    },
    {
      title: 'Creative Generation',
      items: [
        'Batch images and videos from a single source of truth',
        'Aspect-ratio presets for social, ads, marketplaces, and in-store screens',
        'Automatic naming, metadata, and tagging for every asset',
        'Dynamic price formatting and multi-language text fields',
      ],
    },
    {
      title: 'Brand & Compliance',
      items: [
        'Brand-locked templates with fonts, colors, safe zones, and legal copy',
        'Enforced disclosures and fine print per market',
        'Localization guardrails for language, currency, and regulatory text',
        'Audit-ready logs of who changed what and when',
      ],
    },
    {
      title: 'Workflow & Delivery',
      items: [
        'Roles and permissions for marketing, design, and merchandising teams',
        'Approval steps, version history, and rollbacks',
        'Error reporting, QA previews, and collaborative review',
        'Scalable rendering queues with export packages and feed delivery roadmap',
      ],
    },
  ];

  const brandSafetyPoints = [
    'Lock essential brand elements while still allowing controlled variation through logic rules.',
    'Centralize brand kits across teams with fonts, colors, logos, and motion presets.',
    'Automate regional legal text, disclosures, and pricing footnotes for every output.',
    'Maintain traceability with approvals, version history, and audit logs.',
  ];

  const outcomes = [
    'Compress promo production cycles from multi-day timelines to responsive updates.',
    'Eliminate repetitive manual work so teams focus on campaigns, not versioning.',
    'Keep every channel and region in sync the moment product data changes.',
    'Enable rapid experimentation with effortless creative variants.',
  ];

  const useCases = [
    'Weekly or bi-weekly promo cycles with regional pricing shifts',
    'Large catalog updates for e-commerce sites and marketplaces',
    'Marketplace thumbnails, banners, and featured stories generated in bulk',
    'Social bursts with dynamic price badges, motion, and localized copy',
    'In-store screens and printable flyers driven by the same source data',
  ];

  const audiences = [
    'Marketing Managers and Growth Leaders',
    'Creative Directors, Art Directors, and Designers',
    'Merchandising and Category Managers',
    'Ad Ops and Performance Marketing Teams',
    'Digital, IT, and Innovation Leaders partnering with marketing',
  ];

  const comparisonPoints = [
    {
      title: 'Manual tools',
      description:
        'Great for a single hero asset but error-prone at volume. No data logic, limited localization, and every variant needs hand editing.',
    },
    {
      title: 'Custom-coded automation',
      description:
        'Powerful yet dependent on engineers for setup and updates. Long lead times and expensive maintenance for every change request.',
    },
    {
      title: 'Variota',
      description:
        'No-code, logic-first, data-to-creative engine for images and video. Operated by marketing teams with governance and brand safety built in.',
    },
  ];

  const integrationsToday = [
    'Excel/CSV uploads with validation and saved mappings',
    'Google Sheets sync for shared merchandising data',
    'Use existing product image URLs or DAM libraries',
  ];

  const integrationsRoadmap = [
    'PIM, DAM, and CMS connectors',
    'Marketplace and ad platform delivery',
    'SSO and directory sync for enterprise governance',
  ];

  const pilotHighlights = {
    intro:
      'We’re partnering with promo-heavy retailers and e-commerce teams to validate workflows, governance, and outcomes.',
    profile:
      'Ideal pilot profile: multi-region pricing, frequent promo cycles, large SKU catalogs, and creative operations that need scale.',
    provide:
      'What we provide: onboarding support, template setup guidance, logic builder training, dedicated slack, and pilot incentives.',
    ask: 'What we ask: sanitized sample data, 1–2 target templates, weekly working sessions, and candid feedback.',
  };

  const faqs = [
    {
      question: 'What makes Variota different from design tools or ad platforms?',
      answer:
        'Variota connects live product data and business rules directly into creative generation. Instead of manual layout work or limited ad templates, teams define logic once and produce governed assets across every channel.',
    },
    {
      question: 'Can non-technical marketers use the logic builder?',
      answer:
        'Yes. The node-based builder uses plain-language rules, presets, and visual debugging so marketing, merchandising, and creative teams can own automation without code.',
    },
    {
      question: 'How do you handle brand guidelines and approvals?',
      answer:
        'Templates lock critical brand elements while approvals, version history, and audit logs keep every change tracked. Legal copy blocks and safe zones are enforced automatically.',
    },
    {
      question: 'Which data sources can I use? How are errors reported?',
      answer:
        'Start with Excel/CSV or Google Sheets. Field validation, error reports, and QA previews highlight any mismatches before generation.',
    },
    {
      question: 'Can I generate both images and videos? Which formats are supported?',
      answer:
        'Yes. Batch render image and video assets with presets for social, marketplaces, digital signage, and more. Aspect ratios and duration rules are controlled through templates.',
    },
    {
      question: 'How does localization work?',
      answer:
        'Localization rules manage languages, currencies, date formats, and legal text per market so teams launch compliant regional variants instantly.',
    },
    {
      question: 'Do I need engineers to set it up?',
      answer:
        'No. Marketing and creative teams configure rules, while IT partners can assist with governance or data connections as needed.',
    },
    {
      question: 'What about security and privacy?',
      answer:
        'Variota processes only the data you choose to upload, supports data deletion upon request, follows storage best practices, and has SSO and directory sync on the roadmap.',
    },
    {
      question: 'What’s the pricing model?',
      answer:
        'Tiered subscriptions based on usage, seats, and integrations. Pilot and early access pricing is available once we confirm fit.',
    },
    {
      question: 'How do pilots work? What’s expected from our team?',
      answer:
        'We co-design workflows with your team, deliver onboarding and training, and hold weekly check-ins. You provide feedback on outcomes so we can prioritize the roadmap together.',
    },
  ];

  const accessibilityNotes = {
    accessibility: [
      'High-contrast CTAs, keyboard-friendly navigation, and consistent focus states',
      'Alt text for visuals and captions for demo walkthroughs',
      'Legible typography, responsive layouts, and comfortable tap targets on mobile',
    ],
    performance: [
      'Optimized hero media with responsive loading',
      'Lazy-load non-critical visuals and leverage CDN delivery',
      'Compress demo assets to keep the experience fast under pressure',
    ],
    security: [
      'Only process the data teams choose to upload and honor deletion requests',
      'Follow hardened storage practices with scoped access controls',
      'SSO and directory sync are on the roadmap for larger teams',
    ],
  };

  return (
    <HydrateClient>
      <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
        <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--surface-1)]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/dashboard" className="flex items-center gap-3" aria-label="Variota home">
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
              <Link
                href="#investors"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Investors
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
                    Turn your product data into brand-safe images and videos—at scale, without code
                  </h1>
                  <p className="mt-6 max-w-2xl text-lg text-[var(--text-secondary)] sm:text-xl">
                    Import Excel/CSV, set simple if-else rules, and generate thousands of localized
                    assets in minutes. Update instantly when prices or assortments change across
                    regions.
                  </p>

                  <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Link href="#pilot">
                      <Button variant="primary" size="lg" className="w-full sm:w-auto">
                        Apply for Pilot
                        <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                      </Button>
                    </Link>
                    <Link href="#demo" className="w-full sm:w-auto">
                      <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                        <Play className="mr-2 h-5 w-5" aria-hidden="true" /> Watch 2-minute demo
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
                  <div className="space-y-6">
                    <div className="rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--surface-2)]/70 p-4">
                      <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        <Database
                          className="h-5 w-5 text-[var(--accent-primary)]"
                          aria-hidden="true"
                        />
                        <span>Product data import (prices, inventory, imagery)</span>
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--surface-2)]/70 p-4">
                      <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        <Workflow
                          className="h-5 w-5 text-[var(--accent-secondary)]"
                          aria-hidden="true"
                        />
                        <span>
                          No-code rule builder: highlight promos, localize copy, trigger animations
                        </span>
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--surface-2)]/70 p-4">
                      <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        <Layers
                          className="h-5 w-5 text-[var(--node-animation)]"
                          aria-hidden="true"
                        />
                        <span>
                          Asset grid preview: localized images and video thumbnails ready to export
                        </span>
                      </div>
                    </div>
                  </div>
                  <figcaption className="mt-6 text-sm text-[var(--text-tertiary)]">
                    Visualizing the Variota flow: data in, logic applied, governed assets out.
                  </figcaption>
                </figure>
              </div>
            </div>
          </section>

          <section className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/90">
            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12 text-center text-sm text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-center sm:text-base">
              <span className="font-medium text-[var(--text-primary)]">
                Built with insights from retail leaders
              </span>
              <span
                className="hidden h-4 w-px bg-[var(--border-primary)] sm:inline-block"
                aria-hidden="true"
              />
              <span>Designed for promo-heavy retailers and e-commerce teams</span>
              <span
                className="hidden h-4 w-px bg-[var(--border-primary)] sm:inline-block"
                aria-hidden="true"
              />
              <span className="text-[var(--text-tertiary)] italic">
                “If one person can handle a full promo cycle in minutes, that’s a game-changer.”
              </span>
            </div>
          </section>

          <section id="product" className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
            <div className="mb-12 max-w-3xl">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Role-specific wins without adding headcount
              </h2>
              <p className="mt-4 text-lg text-[var(--text-secondary)]">
                Variota equips every go-to-market role with governed automation so teams react to
                market shifts without sacrificing brand or compliance.
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
                  Manual production can’t keep up with modern promo cycles
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
                Teams need a logic-first engine that connects data to creative—fast, consistent, and
                non-technical.
              </p>
            </div>
          </section>

          <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold sm:text-4xl">How Variota works</h2>
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
            <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="#demo">
                <Button variant="primary" size="md">
                  See it in a 2-minute demo
                  <Play className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <p className="text-sm text-[var(--text-tertiary)]">
                Prefer a walkthrough? Request a live session via the early access form below.
              </p>
            </div>
          </section>

          <section
            id="capabilities"
            className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/80"
          >
            <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-bold sm:text-4xl">Capabilities</h2>
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
                  Ship more promotions, faster—without sacrificing brand or control
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
                <h2 className="text-3xl font-bold sm:text-4xl">Where Variota shines</h2>
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
                    Available today
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
                <h2 className="text-3xl font-bold sm:text-4xl">Join the pilot</h2>
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
            <div className="grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
              <div>
                <h2 className="text-3xl font-bold sm:text-4xl">See Variota in action</h2>
                <p className="mt-4 text-lg text-[var(--text-secondary)]">
                  Request early access or book a live demo (15 minutes). Share your context and
                  we’ll tailor the walkthrough.
                </p>
                <p className="mt-6 text-sm text-[var(--text-tertiary)]">
                  We’ll reply within 2 business days.
                </p>
              </div>
              <Card variant="glass" className="p-6">
                <EarlyAccessForm />
              </Card>
            </div>
          </section>

          <section
            id="investors"
            className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/85"
          >
            <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 sm:py-28 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div>
                <h2 className="text-3xl font-bold sm:text-4xl">
                  Building the automation layer for retail creative
                </h2>
                <p className="mt-4 text-lg text-[var(--text-secondary)]">
                  Retail and e-commerce demand high-velocity, data-driven creative. Manual tools and
                  custom-coded pipelines can’t keep pace with multi-region catalogs, compliance, and
                  localization. Variota’s no-code, logic-first engine spans images and video with
                  governance built in.
                </p>
              </div>
              <div className="space-y-6 text-sm text-[var(--text-secondary)]">
                <p>
                  Early traction: pilot pipeline development with promo-heavy retailers, expert
                  endorsements from merchandising leaders, and active design partners co-shaping
                  automation workflows.
                </p>
                <p>
                  Business model: tiered SaaS based on usage, seats, and integrations with
                  enterprise options for governance and delivery.
                </p>
                <Link href="mailto:invest@variota.com" className="inline-flex">
                  <Button variant="primary" size="md">
                    Request investor brief
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          <section id="faq" className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold sm:text-4xl">FAQ</h2>
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
                <h2 className="text-3xl font-bold sm:text-4xl">
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
                context and we’ll align on a pilot path.
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
                {hello
                  ? hello.greeting
                  : 'Welcome to the future of data-driven creative automation.'}
              </p>
            </div>
          </section>
        </main>

        <footer className="border-t border-[var(--border-primary)] bg-[var(--surface-1)]/90">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3"
                  aria-label="Variota logo"
                >
                  <Logo className="h-12 w-48" />
                </Link>
                <p className="mt-4 max-w-md text-sm text-[var(--text-secondary)]">
                  Variota turns product data and business rules into brand-safe images and videos at
                  scale. Subscribe for updates or request early access.
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
                      <Link href="#investors" className="hover:text-[var(--text-primary)]">
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
                      <Link href="#investors" className="hover:text-[var(--text-primary)]">
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
