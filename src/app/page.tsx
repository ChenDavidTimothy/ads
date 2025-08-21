import Link from "next/link";
import { api, HydrateClient } from "@/trpc/server";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { CheckCircle2, Zap, Users, Shield, ArrowRight, Play, Star } from "lucide-react";
import Logo from "@/components/ui/logo";

export default async function LandingPage() {
  // Check if user is already authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Redirect authenticated users to dashboard
  if (user) {
    redirect("/dashboard");
  }

  const hello = await api.post.hello({ text: "from Batchion" });

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "No-Code Animation",
      description: "Create stunning programmatic animations without writing a single line of code using our visual node-based editor."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Business-Focused",
      description: "Built specifically for marketing professionals and business teams to create data-driven video advertisements."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Enterprise Ready",
      description: "Secure, scalable, and reliable infrastructure with enterprise-grade authentication and data protection."
    }
  ];

  const benefits = [
    "Visual node-based programming interface",
    "Server-side rendering for optimal quality",
    "Real-time collaboration and workspace sharing",
    "Advanced animation and timing controls",
    "Export to multiple video formats",
    "Integrated data sources and logic workspaces"
  ];

  return (
    <HydrateClient>
      <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
        {/* Header */}
        <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo className="w-64 h-16" />
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                Pricing
              </Link>
              <Link href="#about" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                About
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link 
                href="/login"
                className="px-6 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Sign In
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
              Create <span className="bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] bg-clip-text text-transparent">Dynamic</span><br />
              Video Ads Without Code
            </h1>
            
            <p className="text-xl text-[var(--text-secondary)] mb-12 leading-relaxed max-w-3xl mx-auto">
              Batchion empowers business professionals to build sophisticated, data-driven video advertisements 
              using an intuitive visual programming interface. No coding experience required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Link 
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg hover:opacity-90 transition-all font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Start Creating Free <ArrowRight className="w-5 h-5" />
              </Link>
              
              <Link 
                href="#demo"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-2)] transition-all font-semibold backdrop-blur-sm"
              >
                <Play className="w-5 h-5" /> Watch Demo
              </Link>
            </div>

            {/* Social Proof */}
            <div className="text-[var(--text-tertiary)] text-sm">
              <p className="mb-4">Trusted by marketing teams at innovative companies</p>
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[var(--warning-500)] text-[var(--warning-500)]" />
                ))}
                <span className="ml-2 text-[var(--text-secondary)]">4.9/5 from early access users</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="bg-[var(--surface-1)] border-y border-[var(--border-primary)]">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-6">Powerful Features for Modern Marketing</h2>
              <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
                Everything you need to create professional, data-driven video content that converts.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-16">
              {features.map((feature, index) => (
                <div key={index} className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-8 backdrop-blur-sm hover:border-[var(--accent-primary)] transition-colors">
                  <div className="w-12 h-12 bg-[var(--accent-primary)] rounded-lg flex items-center justify-center mb-6 text-white">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-4">{feature.title}</h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>

            {/* Benefits List */}
            <div className="bg-[var(--surface-2)] rounded-xl p-8 border border-[var(--border-primary)]">
              <h3 className="text-2xl font-semibold mb-8 text-center">What You Get</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[var(--success-500)] flex-shrink-0" />
                    <span className="text-[var(--text-secondary)]">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">Simple, Transparent Pricing</h2>
            <p className="text-xl text-[var(--text-secondary)]">Start free, scale as you grow</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-8 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-2">Starter</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold">Free</span>
                <span className="text-[var(--text-tertiary)]">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  Up to 3 workspaces
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  Basic animation nodes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  720p video export
                </li>
              </ul>
              <Link 
                href="/login"
                className="w-full block text-center px-6 py-3 border border-[var(--border-primary)] rounded-lg hover:bg-[var(--surface-2)] transition-colors"
              >
                Get Started
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="bg-[var(--glass-bg)] border-2 border-[var(--accent-primary)] rounded-xl p-8 backdrop-blur-sm relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-[var(--accent-primary)] text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Professional</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold">$29</span>
                <span className="text-[var(--text-tertiary)]">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  Unlimited workspaces
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  Advanced logic nodes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  4K video export
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  Priority rendering
                </li>
              </ul>
              <Link 
                href="/login"
                className="w-full block text-center px-6 py-3 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Start Pro Trial
              </Link>
            </div>

            {/* Enterprise Tier */}
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-8 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold">Custom</span>
              </div>
              <ul className="space-y-3 mb-8 text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  Team collaboration
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  Custom integrations
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  Dedicated support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  SLA guarantee
                </li>
              </ul>
              <button className="w-full px-6 py-3 border border-[var(--border-primary)] rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-[var(--surface-1)] to-[var(--surface-2)] border-t border-[var(--border-primary)]">
          <div className="max-w-4xl mx-auto px-6 py-20 text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Video Marketing?</h2>
            <p className="text-xl text-[var(--text-secondary)] mb-12">
              Join hundreds of businesses already creating stunning video content with Batchion.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg hover:opacity-90 transition-all font-semibold text-lg"
              >
                Start Your Free Account <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            <div className="mt-12 text-center">
              <p className="text-[var(--text-tertiary)]">
                {hello ? hello.greeting : "Welcome to the future of video creation"}
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--border-primary)] bg-[var(--surface-1)]">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Logo className="w-48 h-12" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  No-code animation platform for creating dynamic, data-driven video advertisements.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li><Link href="#features" className="hover:text-[var(--text-primary)]">Features</Link></li>
                  <li><Link href="#pricing" className="hover:text-[var(--text-primary)]">Pricing</Link></li>
                  <li><Link href="/login" className="hover:text-[var(--text-primary)]">Sign In</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li><Link href="#about" className="hover:text-[var(--text-primary)]">About</Link></li>
                  <li><Link href="#careers" className="hover:text-[var(--text-primary)]">Careers</Link></li>
                  <li><Link href="#contact" className="hover:text-[var(--text-primary)]">Contact</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li><Link href="/privacy" className="hover:text-[var(--text-primary)]">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-[var(--text-primary)]">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-[var(--border-primary)] mt-8 pt-8 text-center text-sm text-[var(--text-tertiary)]">
              <p>&copy; 2024 Batchion. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </HydrateClient>
  );
}