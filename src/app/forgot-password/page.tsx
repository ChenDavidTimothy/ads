"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/utils/supabase/client";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import Logo from "@/components/ui/logo";

export default function ForgotPasswordPage() {
  const supabase = createBrowserClient();
  
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      // Get the current origin and ensure it's properly formatted
      const origin = window.location.origin;
      const redirectUrl = `${origin}/reset-password`;
      
      console.log('Sending password reset with redirect URL:', redirectUrl);
      
      // For PKCE flow, we need to generate a code verifier and challenge
      // But for password reset, Supabase handles this differently than regular auth
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: redirectUrl,
          // Add additional options for better compatibility
          captchaToken: undefined, // Can be added later if needed
        }
      );

      if (resetError) {
        // Handle specific errors
        switch (resetError.message) {
          case "For security purposes, you can only request this once every 60 seconds":
            setError("Please wait 60 seconds before requesting another reset email.");
            break;
          default:
            setError(resetError.message);
        }
        return;
      }

      setEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Show success state
  if (emailSent) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex flex-col">
        {/* Header */}
        <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/login" className="flex items-center gap-3">
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
              <div className="flex items-center gap-3">
                <Logo className="w-32 h-8" />
              </div>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-8 backdrop-blur-sm shadow-[var(--glass-shadow-lg)] text-center">
              <div className="w-16 h-16 bg-[var(--success-500)] rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
                Check your email
              </h1>
              
              <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
                We&apos;ve sent a password reset link to <strong>{email}</strong>. 
                Please check your email and follow the instructions to reset your password.
              </p>

              <div className="space-y-3">
                <Link 
                  href="/login"
                  className="w-full block py-3 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-all"
                >
                  Back to Sign In
                </Link>
                
                <button 
                  onClick={() => {
                    setEmailSent(false);
                    setEmail("");
                  }}
                  className="w-full py-3 border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                >
                  Try Different Email
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-xs text-[var(--text-tertiary)]">
                  Didn&apos;t receive the email? Check your spam folder or try again in a few minutes.
                </p>
                
                <div className="p-3 bg-[var(--warning-500)]/10 border border-[var(--warning-500)]/20 rounded-lg">
                  <p className="text-xs text-[var(--warning-500)] font-medium">
                    ⏰ Reset links expire after 1 hour for security. Use the link as soon as you receive it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-3">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            <div className="flex items-center gap-3">
                              <Logo className="w-32 h-8" />
            </div>
          </Link>
          
          <div className="text-sm text-[var(--text-secondary)]">
            Remember your password?{" "}
            <Link href="/login" className="text-[var(--accent-primary)] hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Form Container */}
          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-8 backdrop-blur-sm shadow-[var(--glass-shadow-lg)]">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                Forgot your password?
              </h1>
              <p className="text-[var(--text-secondary)]">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-[var(--text-primary)]">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                    placeholder="Enter your email"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 rounded-lg">
                  <p className="text-sm text-[var(--danger-500)] font-medium">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending reset link...
                  </>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="mt-8 pt-6 border-t border-[var(--border-primary)]">
              <p className="text-center text-sm text-[var(--text-secondary)]">
                Remember your password?{" "}
                <Link href="/login" className="text-[var(--accent-primary)] hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Additional Help */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">
              Still having trouble? Contact our{" "}
              <Link href="/contact" className="hover:text-[var(--text-secondary)] underline">
                support team
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
