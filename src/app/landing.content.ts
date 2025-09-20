// Static content for the Variota landing page
// Hoisted to module scope to prevent reallocation on each request

export const microBenefits = [
  'No‑code rules for badges, pricing, layouts, and motion',
  'Localize by region and language with guardrails',
  'Batch‑generate assets for social, ads, marketplaces, and in‑store',
  'One‑click re‑generate when product data changes',
];

export const personaWins = [
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

export const problemPoints = [
  'Prices and assortments change weekly across regions and channels.',
  "Manual tools don't scale to hundreds or thousands of variants.",
  'Custom-coded pipelines are slow to update and need engineers.',
  'Brand and compliance errors under deadline pressure.',
];

export const howItWorksSteps = [
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

export const capabilityGroups = [
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

export const brandSafetyPoints = [
  'Lock brand elements; allow controlled variation via rules.',
  'Enforce regional legal/disclosure blocks automatically.',
  'Centralize brand kits: fonts, colors, logos, motion presets.',
  'Track changes with approvals and version notes (pilot).',
];

export const outcomes = [
  'Produce thousands of governed variants from a single data file: images and video.',
  'Eliminate repetitive manual work so teams focus on campaigns, not versioning.',
  'Keep every channel and region in sync the moment product data changes.',
  'Enable rapid experimentation with effortless creative variants.',
];

export const useCases = [
  'Weekly or bi-weekly promo cycles with regional pricing shifts',
  'Large catalog updates for e-commerce sites and marketplaces',
  'Marketplace thumbnails, banners, and featured stories generated in bulk',
  'Social bursts with dynamic price badges, motion, and localized copy',
  'In-store screens and printable flyers driven by the same source data',
];

export const audiences = [
  'Marketing Managers and Growth Leaders',
  'Creative Directors, Art Directors, and Designers',
  'Merchandising and Category Managers',
  'Ad Ops and Performance Marketing Teams',
  'Digital, IT, and Innovation Leaders partnering with marketing',
];

export const comparisonPoints = [
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

export const integrationsToday = [
  'Manual import support (we prep your CSV/Sheet)',
  'Use existing product image URLs or DAM links',
  'Early template library with dynamic fields',
];

export const integrationsRoadmap = [
  'Self‑serve CSV/Google Sheets import with validation',
  'PIM/DAM/CMS connectors',
  'Direct delivery to ad/marketplace channels',
  'SSO and directory sync (enterprise)',
];

export const pilotHighlights = {
  intro:
    "We're onboarding 3–5 promo‑heavy retailers for a 4–6 week pilot. We'll prep your CSV/Sheet, help set up templates and rules, and deliver your first large batch (e.g., 500–2,000 variants). Limited spots.",
  profile: 'Ideal partners: Multi‑region pricing, weekly promos, 1k+ SKUs, multiple channels.',
  provide:
    'What we provide: Data prep, column mapping, template setup, rule training, batch rendering, Slack support.',
  ask: 'What we ask: Sanitized sample data, 1–2 target templates, 1 hour/week for 4–6 weeks, candid feedback.',
  incentives: 'Pilot incentives: Early pricing and priority input on the roadmap.',
};

export const faqs = [
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
      "Start with CSV or Google Sheets. During pilot, we'll help map your columns, validate fields, and flag errors before generation. You can download error reports, fix in your sheet, and re‑upload.",
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
      "Pilot incentives available after we confirm fit. We'll work with you to customize pricing based on your needs and provide early access terms.",
  },
];

export const accessibilityNotes = {
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
