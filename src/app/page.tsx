"use client";

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Zap, 
  Users, 
  Layers, 
  ArrowRight, 
  Check, 
  Star,
  Target,
  Workflow,
  PaintBucket,
  BarChart3,
  Globe,
  Shield,
  Clock
} from 'lucide-react';

// Simulated components matching your existing design system
const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const variants = {
    primary: "bg-[var(--accent-primary)] text-[var(--text-primary)] hover:brightness-110 border border-[var(--accent-primary)]",
    secondary: "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)] border border-[var(--border-primary)]",
    glass: "glass-button text-[var(--text-primary)]",
    ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--button-ghost-hover)] hover:text-[var(--text-primary)] border border-transparent"
  };
  
  const sizes = {
    sm: "px-[var(--space-3)] py-[var(--space-1)] text-[11px] h-7",
    md: "px-[var(--space-4)] py-[var(--space-2)] text-[12px] h-8",
    lg: "px-[var(--space-5)] py-[var(--space-3)] text-[13px] h-9"
  };

  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all text-refined-medium
        duration-[var(--duration-fast)] ease-[var(--easing-standard)]
        focus:outline-none focus:ring-1 focus:ring-[var(--ring-color)] focus:ring-offset-1 focus:ring-offset-[var(--surface-0)]
        disabled:opacity-40 disabled:cursor-not-allowed rounded-[var(--radius-sm)]
        ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ className = "", variant = "default", error = false, ...props }) => {
  const variants = {
    default: "bg-[var(--surface-2)] border border-[var(--border-primary)]",
    glass: "glass-input"
  };

  return (
    <input
      className={`w-full text-[var(--text-primary)] text-[12px] text-refined transition-all
        duration-[var(--duration-fast)] ease-[var(--easing-standard)]
        placeholder:text-[var(--text-muted)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]
        ${variants[variant]}
        ${error ? "border-[var(--danger-500)] focus:outline-none focus:ring-1 focus:ring-[var(--danger-500)]" : "focus:outline-none focus:ring-1 focus:ring-[var(--ring-color)]"}
        ${className}`}
      {...props}
    />
  );
};

const Badge = ({ children, variant = "default", className = "" }) => {
  const variants = {
    default: "text-[var(--text-tertiary)] bg-transparent",
    result: "text-[var(--text-primary)] bg-[var(--node-output)] border-transparent"
  };

  return (
    <span className={`inline-flex items-center gap-1 px-[var(--space-2)] py-[var(--space-half)]
      rounded-[var(--radius-sm)] text-[10px] border border-[var(--border-primary)]
      ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`glass-panel rounded-[var(--radius-md)] p-[var(--space-4)] ${className}`}>
    {children}
  </div>
);

// Animation node visualization component
const NodeVisualization = () => {
  const [activeNode, setActiveNode] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNode(prev => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const nodes = [
    { type: 'geometry', color: 'var(--node-geometry)', icon: '△', label: 'Shape' },
    { type: 'data', color: 'var(--node-data)', icon: '📊', label: 'Data' },
    { type: 'animation', color: 'var(--node-animation)', icon: '⚡', label: 'Motion' },
    { type: 'output', color: 'var(--node-output)', icon: '🎬', label: 'Video' }
  ];

  return (
    <div className="relative flex items-center justify-center gap-[var(--space-4)] p-[var(--space-6)]">
      {nodes.map((node, index) => (
        <div key={index} className="flex flex-col items-center gap-[var(--space-2)]">
          <div 
            className={`w-12 h-12 rounded-[var(--radius-sm)] border-2 flex items-center justify-center text-sm font-bold transition-all duration-500
              ${activeNode === index ? 'scale-110 shadow-lg' : 'scale-100'}`}
            style={{ 
              backgroundColor: activeNode === index ? node.color : 'var(--surface-2)',
              borderColor: node.color,
              boxShadow: activeNode === index ? `0 0 20px ${node.color}40` : 'none'
            }}
          >
            {node.icon}
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)]">{node.label}</span>
          {index < nodes.length - 1 && (
            <div className={`absolute top-6 h-0.5 w-8 transition-all duration-500 ${
              activeNode > index ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-primary)]'
            }`} style={{ left: `${(index + 1) * 80 - 16}px` }} />
          )}
        </div>
      ))}
    </div>
  );
};

export default function Home() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitted(true);
    // Simulate API call
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="glass-panel border-b border-[var(--border-primary)] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-[var(--space-6)] py-[var(--space-3)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="w-8 h-8 bg-[var(--accent-primary)] rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-sm">
                GB
              </div>
              <span className="font-semibold text-[var(--text-primary)] text-refined-medium">GraphBatch</span>
            </div>
            <nav className="hidden md:flex items-center gap-[var(--space-6)]">
              <a href="#features" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[12px]">Features</a>
              <a href="#pricing" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[12px]">Pricing</a>
              <a href="#examples" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[12px]">Examples</a>
              <Button variant="glass" size="sm">Sign In</Button>
              <Button size="sm">Start Free Trial</Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-[var(--space-8)] px-[var(--space-6)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-[var(--space-8)] items-center">
            <div className="space-y-[var(--space-6)]">
              <div className="space-y-[var(--space-3)]">
                <Badge variant="result">No-Code Animation Platform</Badge>
                <h1 className="text-4xl lg:text-5xl font-bold text-[var(--text-primary)] leading-tight">
                  Create <span className="text-[var(--accent-primary)]">Professional Video Ads</span> Without Code
                </h1>
                <p className="text-lg text-[var(--text-secondary)] text-refined max-w-lg">
                  Build sophisticated, data-driven animations with our intuitive node-based visual programming interface. 
                  Perfect for marketers and business professionals.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-[var(--space-3)] items-start">
                <Button className="flex items-center gap-[var(--space-2)]">
                  <Play size={14} />
                  Start Creating Free
                </Button>
                <Button variant="ghost" className="flex items-center gap-[var(--space-2)]">
                  <Workflow size={14} />
                  Watch Demo
                </Button>
              </div>

              <div className="flex items-center gap-[var(--space-4)] pt-[var(--space-3)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={12} className="fill-[var(--warning-500)] text-[var(--warning-500)]" />
                  ))}
                </div>
                <span className="text-[11px] text-[var(--text-tertiary)]">Trusted by 10,000+ creators</span>
              </div>
            </div>

            <div className="relative">
              <Card className="overflow-hidden">
                <NodeVisualization />
                <div className="border-t border-[var(--border-primary)] mt-[var(--space-4)] pt-[var(--space-4)]">
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                    <span>Visual Node Editor</span>
                    <span className="text-[var(--accent-primary)]">●REC</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-[var(--space-8)] px-[var(--space-6)] bg-[var(--surface-1)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-[var(--space-4)] mb-[var(--space-8)]">
            <h2 className="text-3xl font-bold text-[var(--text-primary)]">
              Everything You Need for <span className="text-[var(--accent-primary)]">Professional Video Production</span>
            </h2>
            <p className="text-[var(--text-secondary)] text-refined max-w-2xl mx-auto">
              Our platform combines the power of professional animation software with the simplicity of visual programming.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-[var(--space-4)]">
            {[
              { icon: Workflow, title: "Visual Node Programming", desc: "Connect nodes instead of writing code. Perfect for non-technical users.", color: "var(--node-animation)" },
              { icon: Layers, title: "Data-Driven Animations", desc: "Import your data and watch it come to life with smart visualizations.", color: "var(--node-data)" },
              { icon: PaintBucket, title: "Beautiful Templates", desc: "Start with professionally designed templates for ads, presentations, and more.", color: "var(--node-geometry)" },
              { icon: Zap, title: "Real-Time Preview", desc: "See your changes instantly with our optimized preview engine.", color: "var(--accent-primary)" },
              { icon: BarChart3, title: "Analytics Integration", desc: "Connect to your business data sources for dynamic content updates.", color: "var(--node-logic)" },
              { icon: Globe, title: "Export Anywhere", desc: "Publish to social media, websites, or download in any format you need.", color: "var(--node-output)" }
            ].map((feature, index) => (
              <Card key={index} className="hover:scale-105 transition-transform duration-300 cursor-pointer">
                <div className="space-y-[var(--space-3)]">
                  <div 
                    className="w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center"
                    style={{ backgroundColor: feature.color + '20', color: feature.color }}
                  >
                    <feature.icon size={20} />
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-refined-medium">{feature.title}</h3>
                  <p className="text-[11px] text-[var(--text-secondary)] text-refined leading-relaxed">{feature.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-[var(--space-8)] px-[var(--space-6)]">
        <div className="max-w-6xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-[var(--space-6)]">
            Trusted by Industry Leaders
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--space-6)] items-center opacity-60">
            {['TechCorp', 'DataFlow', 'VisualCo', 'CreativeInc'].map((company, index) => (
              <div key={index} className="glass-panel p-[var(--space-3)] rounded-[var(--radius-sm)]">
                <span className="font-semibold text-[var(--text-secondary)]">{company}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-[var(--space-8)] px-[var(--space-6)] bg-[var(--surface-1)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[var(--text-primary)] mb-[var(--space-8)]">
            Perfect for <span className="text-[var(--accent-primary)]">Every Use Case</span>
          </h2>
          
          <div className="grid lg:grid-cols-3 gap-[var(--space-6)]">
            {[
              { 
                title: "Marketing Teams", 
                icon: Target,
                points: ["Social media campaigns", "Product demonstrations", "Brand storytelling", "A/B testing variations"],
                color: "var(--node-animation)"
              },
              { 
                title: "Sales Professionals", 
                icon: BarChart3,
                points: ["Proposal presentations", "ROI visualizations", "Client onboarding", "Performance dashboards"],
                color: "var(--node-data)"
              },
              { 
                title: "Content Creators", 
                icon: Users,
                points: ["Educational content", "Tutorial videos", "Brand partnerships", "Audience engagement"],
                color: "var(--node-geometry)"
              }
            ].map((useCase, index) => (
              <Card key={index} className="space-y-[var(--space-4)]">
                <div className="flex items-center gap-[var(--space-3)]">
                  <div 
                    className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center"
                    style={{ backgroundColor: useCase.color + '20', color: useCase.color }}
                  >
                    <useCase.icon size={16} />
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-refined-medium">{useCase.title}</h3>
                </div>
                <ul className="space-y-[var(--space-2)]">
                  {useCase.points.map((point, pointIndex) => (
                    <li key={pointIndex} className="flex items-center gap-[var(--space-2)] text-[11px] text-[var(--text-secondary)]">
                      <Check size={12} className="text-[var(--success-500)] flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-[var(--space-8)] px-[var(--space-6)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-[var(--space-4)] mb-[var(--space-8)]">
            <h2 className="text-3xl font-bold text-[var(--text-primary)]">
              Simple, <span className="text-[var(--accent-primary)]">Transparent Pricing</span>
            </h2>
            <p className="text-[var(--text-secondary)] text-refined">Choose the plan that fits your needs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-[var(--space-4)]">
            {[
              {
                name: "Starter",
                price: "Free",
                period: "forever",
                features: ["5 projects", "Basic templates", "720p exports", "Community support"],
                button: "Get Started",
                variant: "secondary"
              },
              {
                name: "Professional",
                price: "$29",
                period: "per month",
                features: ["Unlimited projects", "Premium templates", "4K exports", "Priority support", "Advanced integrations"],
                button: "Start Free Trial",
                variant: "primary",
                popular: true
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "contact us",
                features: ["Custom branding", "SSO integration", "Dedicated support", "On-premise deployment", "Custom templates"],
                button: "Contact Sales",
                variant: "glass"
              }
            ].map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="result">Most Popular</Badge>
                  </div>
                )}
                <div className="space-y-[var(--space-4)]">
                  <div className="text-center space-y-[var(--space-2)]">
                    <h3 className="font-semibold text-[var(--text-primary)] text-refined-medium">{plan.name}</h3>
                    <div className="space-y-1">
                      <span className="text-2xl font-bold text-[var(--text-primary)]">{plan.price}</span>
                      {plan.period && <span className="text-[11px] text-[var(--text-tertiary)]">/{plan.period}</span>}
                    </div>
                  </div>
                  <ul className="space-y-[var(--space-2)]">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-[var(--space-2)] text-[11px] text-[var(--text-secondary)]">
                        <Check size={12} className="text-[var(--success-500)] flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button variant={plan.variant} className="w-full">
                    {plan.button}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-[var(--space-8)] px-[var(--space-6)] bg-[var(--surface-1)]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="space-y-[var(--space-6)]">
            <div className="space-y-[var(--space-3)]">
              <h2 className="text-3xl font-bold text-[var(--text-primary)]">
                Ready to <span className="text-[var(--accent-primary)]">Transform Your Content?</span>
              </h2>
              <p className="text-[var(--text-secondary)] text-refined max-w-2xl mx-auto">
                Join thousands of creators who are already using GraphBatch to create stunning video content without any coding knowledge.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-[var(--space-3)] max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
                variant="glass"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && email.trim()) {
                    handleSubmit(e);
                  }
                }}
              />
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitted || !email.trim()} 
                className="flex items-center gap-[var(--space-2)]"
              >
                {isSubmitted ? (
                  <>
                    <Check size={14} />
                    Sent!
                  </>
                ) : (
                  <>
                    <ArrowRight size={14} />
                    Get Started
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-[var(--space-4)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <Shield size={12} />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-[var(--space-1)]">
                <Clock size={12} />
                <span>14-day free trial</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-[var(--space-6)] px-[var(--space-6)] border-t border-[var(--border-primary)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="w-6 h-6 bg-[var(--accent-primary)] rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[10px]">
                GB
              </div>
              <span className="text-[var(--text-secondary)] text-[11px]">© 2025 GraphBatch. All rights reserved.</span>
            </div>
            <nav className="flex items-center gap-[var(--space-4)] text-[11px] text-[var(--text-tertiary)]">
              <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Terms</a>
              <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Support</a>
              <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Documentation</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}