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
    'No‑code rules for badges, pricing, layouts, and motion',
    'Localize by region and language with guardrails',
    'Batch‑generate assets for social, ads, marketplaces, and in‑store',
    'One‑click re‑generate when product data changes',
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
        'Automate repetitive variants with consistent templates so designers focus on storytelling instead of manual versioning.',
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
    'Prices and assortments change weekly across regions and channels.',
    "Manual tools don't scale to hundreds or thousands of variants.",
    'Custom-coded pipelines are slow to update and need engineers.',
    'Brand and compliance errors under deadline pressure.',
  ];

  const howItWorksSteps = [
    {
      title: 'Import data',
      description:
        'Import product data from a sheet, CSV, or API. Map price, discount, market, and image URL fields in minutes.',
    },
    {
      title: 'Build rules',
      description:
        'Build rules visually with a node‑based builder (e.g., If discount ≥ 20% then show red "Save {discount}%" badge).',
    },
    {
      title: 'Choose templates',
      description:
        'Start with on‑brand templates with dynamic fields and safe zones for each channel.',
    },
    {
      title: 'Generate at scale',
      description:
        'Batch‑generate images and short videos for all SKUs and markets in a single run, with parallel rendering.',
    },
    {
      title: 'Review and publish',
      description:
        'Preview variants, export packages, or deliver via feeds. Re‑generate when data changes.',
    },
  ];

  const capabilityGroups = [
    {
      title: 'Data & Logic',
      items: [
        { text: 'CSV/Sheet import with column mapping and validation', chip: 'Pilot' },
        { text: 'No‑code rules tied to product attributes and thresholds', chip: null },
        { text: 'Regional variants with currency and localized copy guardrails', chip: null },
      ],
    },
    {
      title: 'Creative Generation',
      items: [
        { text: 'Batch images and short videos from one source of truth', chip: null },
        { text: 'Presets for social, ads, and marketplace aspect ratios', chip: null },
        { text: 'Automatic naming and metadata (basic)', chip: null },
      ],
    },
    {
      title: 'Brand & Compliance',
      items: [
        { text: 'Brand‑locked templates with fonts, colors, safe zones', chip: null },
        { text: 'Legal copy blocks per market (configurable)', chip: null },
        { text: 'Version history and approvals (pilot scope)', chip: 'Pilot' },
      ],
    },
    {
      title: 'Workflow & Delivery',
      items: [
        { text: 'Roles and permissions (basic roles)', chip: null },
        { text: 'QA previews and error reporting (pilot)', chip: 'Pilot' },
        { text: 'Export packages for channels; feeds (roadmap)', chip: 'Roadmap' },
      ],
    },
  ];

  const brandSafetyPoints = [
    'Lock brand elements; allow controlled variation via rules.',
    'Enforce regional legal/disclosure blocks automatically.',
    'Centralize brand kits: fonts, colors, logos, motion presets.',
    'Track changes with approvals and version notes (pilot).',
  ];

  const outcomes = [
    'Produce thousands of governed variants from a single data file: images and video.',
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
        'A no‑code, logic‑first data‑to‑creative engine that batch‑generates images and video at scale, operated by marketing, with brand safety built in.',
    },
  ];

  const integrationsToday = [
    'Manual import support (we prep your CSV/Sheet)',
    'Use existing product image URLs or DAM links',
    'Early template library with dynamic fields',
  ];

  const integrationsRoadmap = [
    'Self‑serve CSV/Google Sheets import with validation',
    'PIM/DAM/CMS connectors',
    'Direct delivery to ad/marketplace channels',
    'SSO and directory sync (enterprise)',
  ];

  const pilotHighlights = {
    intro:
      "We're onboarding 3–5 promo‑heavy retailers for a 4–6 week pilot. We'll prep your CSV/Sheet, help set up templates and rules, and deliver your first large batch (e.g., 500–2,000 variants). Limited spots.",
    profile:
      'Ideal partners: Multi‑region pricing, weekly promos, 1k+ SKUs, multiple channels.',
    provide:
      'What we provide: Data prep, column mapping, template setup, rule training, batch rendering, Slack support.',
    ask: 'What we ask: Sanitized sample data, 1–2 target templates, 1 hour/week for 4–6 weeks, candid feedback.',
    incentives: 'Pilot incentives: Early pricing and priority input on the roadmap.',
  };

  const faqs = [
    {
      question: 'What makes Variota different from design tools or ad platforms?',
      answer:
        'Variota connects live product data and business rules directly into creative generation. Instead of manual layout work or limited ad templates, teams define logic once and produce governed assets across every channel.',
    },
    {
      question: 'Can non-technical marketers use the rules?',
      answer:
        'Yes. The node‑based builder uses drag‑and‑drop conditions, presets, and visual debugging so marketing, merchandising, and creative teams can automate without code.',
    },
    {
      question: 'Which data sources can I use? How are errors handled?',
      answer:
        'Start with CSV or Google Sheets. During pilot, we\'ll help map your columns, validate fields, and flag errors before generation. You can download error reports, fix in your sheet, and re‑upload.',
    },
    {
      question: 'Can I generate both images and short videos?',
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
      question: "What's the pricing model during pilot?",
      answer:
        'Pilot incentives available after we confirm fit. We\'ll work with you to customize pricing based on your needs and provide early access terms.',
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
      'Data deletion upon request and scoped access controls',
    ],
  };

  return (
    <HydrateClient>
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
                    Build visual rules for prices, discounts, markets, and inventory that trigger badges,
                    layouts, motion, and copy. Batch‑generate thousands of image and video variants.
                  </p>
                  <ul className="mt-6 space-y-2 text-sm text-[var(--text-tertiary)]">
                    <li>• If discount ≥ 20% → show red "Save &#123;discount&#125;%" badge across all eligible SKUs</li>
                    <li>• If market = FR → use EUR, comma decimal, and French legal copy across French variants</li>
                    <li>• If inventory &lt; threshold → switch to "Limited stock" layout with pulse for those products</li>
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
                  <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)]">
                    {/* [PLACEHOLDER VISUAL: Data sources (Sheet/API/CSV) → Node graph (conditions/actions) → Variants grid] */}
                    <div className="text-center">
                      <Database className="h-16 w-16 mx-auto mb-4 text-[var(--accent-primary)]" aria-hidden="true" />
                      <p className="text-lg font-medium">Data → Node Rules → Variants</p>
                      <p className="text-sm mt-2">Coming soon: Visual rule builder demo</p>
                    </div>
                  </div>
                  <figcaption className="mt-6 text-sm text-[var(--text-tertiary)]">
                    Data sources (Sheet/API/CSV) → Node graph (conditions/actions) → Variants grid. Build rules visually with drag-and-drop nodes for conditions that trigger creative changes.
                  </figcaption>
                </figure>
              </div>
            </div>
          </section>

          <section className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]/90">
            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12 text-center text-sm text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-center sm:text-base">
              <span className="font-medium text-[var(--text-primary)]">
                Now recruiting 3–5 pilot partners in promo-heavy retail. We'll prep your CSV/Sheet for you.
              </span>
            </div>
          </section>

          <section id="product" className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
            <div className="mb-12 max-w-3xl">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Benefits for every team - without adding headcount
              </h2>
              <p className="mt-4 text-lg text-[var(--text-secondary)]">
                Variota gives marketing and merchandising teams a simple way to turn product data into on‑brand creative at scale - without waiting on production.
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
                  "Manual production can't keep up with modern promo cycles"
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
                Teams need a logic-first engine that connects data to creative. Fast, consistent, and
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
            <div className="mt-12">
              {/* [PLACEHOLDER: HOW-IT-WORKS GIF - CSV upload → column mapping → rules → variants preview] */}
              <div className="flex items-center justify-center h-64 bg-[var(--surface-2)]/50 rounded-[var(--radius-lg)] border border-[var(--border-primary)]">
                <div className="text-center text-[var(--text-tertiary)]">
                  <Play className="h-12 w-12 mx-auto mb-4 text-[var(--accent-primary)]" aria-hidden="true" />
                  <p className="text-lg font-medium">Interactive workflow preview</p>
                  <p className="text-sm mt-2">Coming soon: Step-by-step visual guide</p>
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
                    In pilot now
                    <span className="ml-2 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">Private beta</span>
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
                  <h2 className="text-3xl font-bold sm:text-4xl">See Variota in action</h2>
                  <p className="mt-4 text-lg text-[var(--text-secondary)]">
                    Watch a 2-minute walkthrough of importing data, setting rules, and generating variants. Prefer live? Book a 15-minute session below.
                  </p>
                  <p className="mt-6 text-sm text-[var(--text-tertiary)]">
                    We’ll reply within 2 business days.
                  </p>
                </div>
                <Card variant="glass" className="p-0 overflow-hidden">
                  <div className="aspect-video w-full">
                    {/* [PLACEHOLDER: EMBEDDED VIDEO - use an iframe] */}
                    <div className="flex h-full items-center justify-center bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                      <div className="text-center">
                        <Play className="h-16 w-16 mx-auto mb-4 text-[var(--accent-primary)]" aria-hidden="true" />
                        <p className="text-lg font-medium">2-minute demo video</p>
                        <p className="text-sm mt-2">Coming soon: Live walkthrough</p>
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
                context and we'll align on a pilot path.
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
                  href="/"
                  className="flex items-center gap-3"
                  aria-label="Variota logo"
                >
                  <Logo className="h-12 w-48" />
                </Link>
                <p className="mt-4 max-w-md text-sm text-[var(--text-secondary)]">
                  Variota turns product data and business rules into professional images and videos at
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
