import Link from "next/link";
import { api, HydrateClient } from "@/trpc/server";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Zap,
  Users,
  Shield,
  ArrowRight,
  Play,
  Star,
} from "lucide-react";
import Logo from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  // Check if user is already authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect authenticated users to dashboard
  if (user) {
    redirect("/dashboard");
  }

  const hello = await api.post.hello({ text: "from Batchion" });

  const features = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: "No-Code Animation",
      description:
        "Create stunning programmatic animations without writing a single line of code using our visual node-based editor.",
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Business-Focused",
      description:
        "Built specifically for marketing professionals and business teams to create data-driven video advertisements.",
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Enterprise Ready",
      description:
        "Secure, scalable, and reliable infrastructure with enterprise-grade authentication and data protection.",
    },
  ];

  const benefits = [
    "Visual node-based programming interface",
    "Server-side rendering for optimal quality",
    "Real-time collaboration and workspace sharing",
    "Advanced animation and timing controls",
    "Export to multiple video formats",
    "Integrated data sources and logic workspaces",
  ];

  return (
    <HydrateClient>
      <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Logo className="h-16 w-64" />
            </div>

            <nav className="hidden items-center gap-8 md:flex">
              <Link
                href="#features"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Pricing
              </Link>
              <Link
                href="#about"
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                About
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="primary" size="sm">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-6 py-20 text-center">
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-8 text-5xl leading-tight font-extrabold tracking-tight md:text-7xl">
              Create{" "}
              <span className="bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] bg-clip-text text-transparent">
                Dynamic
              </span>
              <br />
              Video Ads Without Code
            </h1>

            <p className="mx-auto mb-12 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">
              Batchion empowers business professionals to build sophisticated,
              data-driven video advertisements using an intuitive visual
              programming interface. No coding experience required.
            </p>

            <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/login">
                <Button
                  variant="primary"
                  size="lg"
                  className="transform hover:scale-105"
                >
                  Start Creating Free <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>

              <Link href="#demo">
                <Button variant="glass" size="lg">
                  <Play className="h-5 w-5" /> Watch Demo
                </Button>
              </Link>
            </div>

            {/* Social Proof */}
            <div className="text-sm text-[var(--text-tertiary)]">
              <p className="mb-4">
                Trusted by marketing teams at innovative companies
              </p>
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-[var(--warning-500)] text-[var(--warning-500)]"
                  />
                ))}
                <span className="ml-2 text-[var(--text-secondary)]">
                  4.9/5 from early access users
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="border-y border-[var(--border-primary)] bg-[var(--surface-1)]"
        >
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="mb-16 text-center">
              <h2 className="mb-6 text-4xl font-bold">
                Powerful Features for Modern Marketing
              </h2>
              <p className="mx-auto max-w-2xl text-xl text-[var(--text-secondary)]">
                Everything you need to create professional, data-driven video
                content that converts.
              </p>
            </div>

            <div className="mb-16 grid gap-8 md:grid-cols-3">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 backdrop-blur-sm transition-colors hover:border-[var(--accent-primary)]"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-white">
                    {feature.icon}
                  </div>
                  <h3 className="mb-4 text-xl font-semibold">
                    {feature.title}
                  </h3>
                  <p className="leading-relaxed text-[var(--text-secondary)]">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Benefits List */}
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] p-8">
              <h3 className="mb-8 text-center text-2xl font-semibold">
                What You Get
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[var(--success-500)]" />
                    <span className="text-[var(--text-secondary)]">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-16 text-center">
            <h2 className="mb-6 text-4xl font-bold">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-[var(--text-secondary)]">
              Start free, scale as you grow
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {/* Free Tier */}
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 backdrop-blur-sm">
              <h3 className="mb-2 text-xl font-semibold">Starter</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold">Free</span>
                <span className="text-[var(--text-tertiary)]">/month</span>
              </div>
              <ul className="mb-8 space-y-3 text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  Up to 3 workspaces
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  Basic animation nodes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  720p video export
                </li>
              </ul>
              <Link
                href="/login"
                className="block w-full rounded-lg border border-[var(--border-primary)] px-6 py-3 text-center transition-colors hover:bg-[var(--surface-2)]"
              >
                Get Started
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="relative rounded-xl border-2 border-[var(--accent-primary)] bg-[var(--glass-bg)] p-8 backdrop-blur-sm">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform">
                <span className="rounded-full bg-[var(--accent-primary)] px-4 py-1 text-sm font-medium text-white">
                  Most Popular
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Professional</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold">$29</span>
                <span className="text-[var(--text-tertiary)]">/month</span>
              </div>
              <ul className="mb-8 space-y-3 text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  Unlimited workspaces
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  Advanced logic nodes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  4K video export
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  Priority rendering
                </li>
              </ul>
              <Link href="/login" className="block w-full">
                <Button variant="primary" className="w-full">
                  Start Pro Trial
                </Button>
              </Link>
            </div>

            {/* Enterprise Tier */}
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 backdrop-blur-sm">
              <h3 className="mb-2 text-xl font-semibold">Enterprise</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold">Custom</span>
              </div>
              <ul className="mb-8 space-y-3 text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  Team collaboration
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  Custom integrations
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  Dedicated support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  SLA guarantee
                </li>
              </ul>
              <button className="w-full rounded-lg border border-[var(--border-primary)] px-6 py-3 transition-colors cursor-pointer hover:bg-[var(--surface-2)]">
                Contact Sales
              </button>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-[var(--border-primary)] bg-gradient-to-r from-[var(--surface-1)] to-[var(--surface-2)]">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <h2 className="mb-6 text-4xl font-bold">
              Ready to Transform Your Video Marketing?
            </h2>
            <p className="mb-12 text-xl text-[var(--text-secondary)]">
              Join hundreds of businesses already creating stunning video
              content with Batchion.
            </p>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] px-8 py-4 text-lg font-semibold text-white transition-all hover:opacity-90"
              >
                Start Your Free Account <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="mt-12 text-center">
              <p className="text-[var(--text-tertiary)]">
                {hello
                  ? hello.greeting
                  : "Welcome to the future of video creation"}
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--border-primary)] bg-[var(--surface-1)]">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="grid gap-8 md:grid-cols-4">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <Logo className="h-12 w-48" />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  No-code animation platform for creating dynamic, data-driven
                  video advertisements.
                </p>
              </div>

              <div>
                <h4 className="mb-4 font-semibold">Product</h4>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li>
                    <Link
                      href="#features"
                      className="hover:text-[var(--text-primary)]"
                    >
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="#pricing"
                      className="hover:text-[var(--text-primary)]"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/login"
                      className="hover:text-[var(--text-primary)]"
                    >
                      Sign In
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-4 font-semibold">Company</h4>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li>
                    <Link
                      href="#about"
                      className="hover:text-[var(--text-primary)]"
                    >
                      About
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="#careers"
                      className="hover:text-[var(--text-primary)]"
                    >
                      Careers
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="#contact"
                      className="hover:text-[var(--text-primary)]"
                    >
                      Contact
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-4 font-semibold">Legal</h4>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li>
                    <Link
                      href="/privacy"
                      className="hover:text-[var(--text-primary)]"
                    >
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/terms"
                      className="hover:text-[var(--text-primary)]"
                    >
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-[var(--border-primary)] pt-8 text-center text-sm text-[var(--text-tertiary)]">
              <p>&copy; 2024 Batchion. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </HydrateClient>
  );
}
