// Static content for the Variota landing page
// Hoisted to module scope to prevent reallocation on each request

export type Chip = 'Pilot' | 'Roadmap' | null;
export type CapabilityItem = { text: string; chip: Chip };
export type CapabilityGroup = { title: string; items: CapabilityItem[] };
export type CapabilityGroupTitle = 'Data & Logic' | 'Creative Generation' | 'Brand & Compliance' | 'Workflow & Delivery';

export const microBenefits = Object.freeze([
  'No‑code rules for badges, pricing, layouts, and motion',
  'Localize by region and language with guardrails',
  'Batch‑generate assets for social, ads, marketplaces, and in‑store',
  'One‑click regenerate when product data changes',
] as const);

export const personaWins = Object.freeze([
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
] as const);

export const problemPoints = Object.freeze([
  'Prices and assortments change weekly across regions and channels',
  "Manual tools don't scale to hundreds or thousands of variants",
  'Custom-coded pipelines are slow to update and need engineers',
  'Brand and compliance errors under deadline pressure',
] as const);

export const howItWorksSteps = Object.freeze([
  {
    title: 'Import data',
    description:
      'Import product data from a sheet, CSV, or API. Map price, discount, market, and image URL fields in minutes.',
  },
  {
    title: 'Build rules',
    description:
      'Build rules visually with a node‑based builder (e.g., If discount ≥ 20% then show red Save {discount}% badge).',
  },
  {
    title: 'Choose templates',
    description:
      'Start with on‑brand templates with dynamic fields and safe zones for each channel.',
  },
  {
    title: 'Generate at scale',
    description:
      'Batch‑generate images and short‑form videos for all SKUs and markets in a single run, with parallel rendering.',
  },
  {
    title: 'Review and publish',
    description:
      'Preview variants, export packages, or deliver via feeds. Re‑generate when data changes.',
  },
] as const);

export const capabilityGroups = Object.freeze([
  {
    title: 'Data & Logic',
    items: [
      { text: 'CSV/Sheet import with column mapping and validation', chip: 'Pilot' },
      { text: 'No‑code rules tied to product attributes and thresholds', chip: null },
      { text: 'Regional variants with currency formats and localized copy guardrails', chip: null },
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
      { text: 'Version history and approvals', chip: 'Pilot' },
    ],
  },
  {
    title: 'Workflow & Delivery',
    items: [
      { text: 'Roles and permissions (basic roles)', chip: null },
      { text: 'QA previews and error reporting', chip: 'Pilot' },
      { text: 'Export packages for channels; feeds', chip: 'Roadmap' },
    ],
  },
] as const);

export const brandSafetyPoints = Object.freeze([
  'Lock brand elements; allow controlled variation via rules.',
  'Enforce regional legal/disclosure blocks automatically.',
  'Centralize brand kits: fonts, colors, logos, motion presets.',
  'Track changes with approvals and version notes.',
] as const);

export const outcomes = Object.freeze([
  'Produce thousands of governed variants from a single data file: images and videos.',
  'Eliminate repetitive manual work so teams focus on campaigns, not versioning.',
  'Keep every channel and region in sync the moment product data changes.',
  'Enable rapid experimentation with effortless creative variants.',
] as const);

export const useCases = Object.freeze([
  'Weekly or biweekly promo cycles with regional pricing shifts',
  'Large catalog updates for e-commerce sites and marketplaces',
  'Marketplace thumbnails, banners, and featured stories generated in bulk',
  'Social bursts with dynamic price badges, motion, and localized copy',
  'In-store screens and printable flyers driven by the same source data',
] as const);

export const audiences = Object.freeze([
  'Marketing Managers and Growth Leaders',
  'Creative Directors, Art Directors, and Designers',
  'Merchandising and Category Managers',
  'Ad Ops and Performance Marketing Teams',
  'Digital, IT, and Innovation Leaders partnering with marketing',
] as const);

export const comparisonPoints = Object.freeze([
  {
    title: 'Manual tools',
    description:
      'Great for a single hero asset but error-prone at volume. No data logic, limited localization, and every variant requires hand editing.',
  },
  {
    title: 'Custom-coded automation',
    description:
      'Powerful yet dependent on engineers for setup and updates. Long lead times and expensive maintenance for every change request.',
  },
  {
    title: 'Variota',
    description:
      'A no‑code, logic‑first data‑to‑creative engine that batch‑generates images and video at scale, operable by marketing, with brand safety built in.',
  },
] as const);

export const integrationsToday = Object.freeze([
  'Manual import support (we prep your CSV/Sheet)',
  'Use existing product image URLs or DAM asset links',
  'Early template library with dynamic fields',
] as const);

export const integrationsRoadmap = Object.freeze([
  'Self‑serve CSV/Google Sheets import with validation',
  'Connectors for PIM/DAM/CMS',
  'Direct delivery to ad platforms and marketplace channels',
  'SSO and directory sync (enterprise)',
] as const);

export const pilotHighlights = Object.freeze({
  intro:
    "We're onboarding 3–5 promo‑heavy retailers for a 4–6 week pilot. We'll prep your CSV/Sheet, help set up templates and rules, and deliver your first large batch (e.g., 500–2,000 variants). Limited spots.",
  profile: 'Ideal partners: Multi‑region pricing, weekly promos, 1K+ SKUs, multiple channels.',
  provide:
    'Data prep, column mapping, template setup, rule training, batch rendering, Slack support.',
  ask: 'Sanitized sample data, 1–2 target templates, 1 hour/week for 4–6 weeks, candid feedback.',
  incentives: 'Pilot incentives available once we confirm fit.',
} as const);

export const faqs = Object.freeze([
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
      "Start with CSV or Google Sheets. During pilot, we'll help map your columns, validate fields, and flag errors before generation. You can download error reports, fix in your sheet, and reupload.",
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
      "Pilot incentives available once we confirm fit. We'll work with you to customize pricing based on your needs and provide early access terms.",
  },
] as const);

export const accessibilityNotes = Object.freeze({
  accessibility: [
    'High‑contrast CTAs, keyboard‑friendly navigation, and consistent focus states',
    'Alt text for visuals and captions for demo walkthroughs',
    'Legible typography, responsive layouts, and comfortable tap targets on mobile',
  ],
  performance: [
    'Optimized hero media with responsive loading',
    'Lazy-load non-critical visuals and leverage CDN delivery',
    'Compress demo assets to keep the experience fast under load',
  ],
  security: [
    'Only process the data teams choose to upload and honor deletion requests',
    'Follow hardened storage practices with scoped access controls',
    'Data deletion upon request and auditability',
  ],
} as const);
