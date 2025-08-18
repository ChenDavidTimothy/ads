"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/utils/supabase/client";
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Lock
} from "lucide-react";
import Logo from "@/components/ui/logo";

// Separate component that uses useSearchParams
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 1: Check for existing session or exchange code for session
  useEffect(() => {
    const checkSession = async () => {
      // Check if session already exists (from Supabase redirect)
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSessionReady(true);
        return;
      }

      // Otherwise, try to exchange the code
      if (!searchParams) return;

      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (errorParam) {
        setError(
          decodeURIComponent(errorDescription ?? "Reset link invalid or expired.")
        );
        return;
      }

      if (!code) {
        setError("Invalid or missing reset link.");
        return;
      }

      const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !exchangeData.session) {
        setError("Reset link expired or invalid. Please request a new one.");
        return;
      }

      setSessionReady(true);
      window.history.replaceState({}, document.title, "/reset-password");
    };

    void checkSession();
  }, [supabase.auth, searchParams]);

  // Step 2: Handle password update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sessionReady) {
      setError("Reset session expired. Please request a new link.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      void router.push("/dashboard");
    }, 2000);
  };

  // Password validation helpers
  const isPasswordValid = password.length >= 8;
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = sessionReady && isPasswordValid && doPasswordsMatch && !loading;

  // Success state
  if (success) {
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
                Password updated successfully!
              </h1>
              
              <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
                Your password has been reset successfully. You&apos;ll be redirected to the dashboard in a few seconds.
              </p>

              <Link 
                href="/dashboard"
                className="w-full block py-3 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-all"
              >
                Go to Dashboard
              </Link>
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
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] rounded-lg flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                Reset your password
              </h1>
              <p className="text-[var(--text-secondary)]">
                Enter your new password below to complete the reset process.
              </p>
            </div>

            {/* Loading state */}
            {!sessionReady && !error && (
              <div className="mb-6 p-4 bg-[var(--info-500)]/10 border border-[var(--info-500)]/20 rounded-lg">
                <div className="flex items-center gap-3 text-[var(--info-500)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Verifying reset link...</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 rounded-lg">
                <div className="flex items-center gap-3 text-[var(--danger-500)]">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* New Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-[var(--text-primary)]">
                  New password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                    placeholder="Enter new password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="text-xs">
                    {isPasswordValid ? (
                      <span className="text-[var(--success-500)]">✓ Password meets requirements</span>
                    ) : (
                      <span className="text-[var(--danger-500)]">Password must be at least 8 characters</span>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-primary)]">
                  Confirm new password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                    placeholder="Confirm new password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="text-xs">
                    {doPasswordsMatch ? (
                      <span className="text-[var(--success-500)]">✓ Passwords match</span>
                    ) : (
                      <span className="text-[var(--danger-500)]">Passwords do not match</span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  "Update password"
                )}
              </button>

              {/* Helper text */}
              {!canSubmit && (
                <div className="text-center">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {!sessionReady && "Waiting for reset link verification..."}
                    {sessionReady && !isPasswordValid && "Password must be at least 8 characters"}
                    {sessionReady && isPasswordValid && !doPasswordsMatch && "Passwords must match"}
                  </p>
                </div>
              )}
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
              Need a new reset link?{" "}
              <Link href="/forgot-password" className="hover:text-[var(--text-secondary)] underline">
                Request another one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}