"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/utils/supabase/client";
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import Logo from "@/components/ui/logo";

// Separate component that uses useSearchParams
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Get redirect URL from search params
  const redirectTo = searchParams?.get('redirectTo');

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Redirect to the originally requested page or dashboard
          const destination = redirectTo?.startsWith('/') ? redirectTo : "/dashboard";
          router.push(destination);
          return;
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    void checkAuth();
  }, [router, supabase.auth, redirectTo]);

  // Rate limiting effect
  useEffect(() => {
    if (attempts >= 5) {
      setIsRateLimited(true);
      const timer = setTimeout(() => {
        setIsRateLimited(false);
        setAttempts(0);
      }, 15 * 60 * 1000); // 15 minutes
      return () => clearTimeout(timer);
    }
  }, [attempts]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 6) {
      return { isValid: false, message: "Password must be at least 6 characters" };
    }
    if (password.length > 128) {
      return { isValid: false, message: "Password must be less than 128 characters" };
    }
    return { isValid: true, message: "" };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Rate limiting check
    if (isRateLimited) {
      setError("Too many login attempts. Please wait 15 minutes before trying again.");
      return;
    }

    // Client-side validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      return;
    }

    setLoading(true);
    setAttempts(prev => prev + 1);

    try {
      const { error: signInError, data } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Provide user-friendly error messages
        switch (signInError.message) {
          case "Invalid login credentials":
            setError("Invalid email or password. Please check your credentials and try again.");
            break;
          case "Email not confirmed":
            setError("Please check your email and click the confirmation link before signing in.");
            break;
          case "Too many requests":
            setError("Too many login attempts. Please wait 15 minutes before trying again.");
            setIsRateLimited(true);
            break;
          case "User not found":
            setError("No account found with this email address. Please check your email or create a new account.");
            break;
          case "Invalid email or password":
            setError("Invalid email or password. Please check your credentials and try again.");
            break;
          default:
            setError(signInError.message || "An error occurred during sign in");
        }
        return;
      }

      // Success handling
      if (data.user) {
        const destination = redirectTo?.startsWith('/') ? redirectTo : "/dashboard";
        setSuccess(`Sign in successful! Redirecting${destination !== "/dashboard" ? " to your requested page" : ""}...`);
        
        // Mark successful login for auth status component
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('justSignedIn', '1');
          
          // Handle remember me
          if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
          } else {
            localStorage.removeItem('rememberMe');
          }
        }

        // Redirect after a brief delay to show success message
        setTimeout(() => {
          router.push(destination);
        }, 1500);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Clear error when user starts typing
    if (error) setError(null);
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Checking authentication...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            <div className="flex items-center gap-3">
              <Logo className="w-32 h-8" />
            </div>
          </Link>
          
          <div className="text-sm text-[var(--text-secondary)]">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[var(--accent-primary)] hover:underline font-medium transition-colors">
              Sign up
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
                Welcome back
              </h1>
              <p className="text-[var(--text-secondary)]">
                Sign in to your Batchion account
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
                    onChange={handleEmailChange}
                    className="w-full pl-10 pr-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter your email"
                    disabled={loading || isRateLimited}
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-[var(--text-primary)]">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={handlePasswordChange}
                    className="w-full pl-10 pr-12 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter your password"
                    disabled={loading || isRateLimited}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading || isRateLimited}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-[var(--text-tertiary)]" />
                    ) : (
                      <Eye className="h-5 w-5 text-[var(--text-tertiary)]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border-primary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] focus:ring-2 focus:ring-offset-0 bg-[var(--glass-bg)]"
                    disabled={loading || isRateLimited}
                  />
                  <label htmlFor="remember-me" className="ml-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                    Remember me for 30 days
                  </label>
                </div>
                
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-[var(--accent-primary)] hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-[var(--danger-500)] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[var(--danger-500)] font-medium">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="p-3 bg-[var(--success-500)]/10 border border-[var(--success-500)]/20 rounded-lg flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-[var(--success-500)] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[var(--success-500)] font-medium">{success}</p>
                </div>
              )}

              {/* Rate Limiting Warning */}
              {isRateLimited && (
                <div className="p-3 bg-[var(--warning-500)]/10 border border-[var(--warning-500)]/20 rounded-lg">
                  <p className="text-sm text-[var(--warning-500)] font-medium">
                    Too many login attempts. Please wait 15 minutes before trying again.
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || isRateLimited}
                className="w-full py-3 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="mt-8 pt-6 border-t border-[var(--border-primary)]">
              <p className="text-center text-sm text-[var(--text-secondary)]">
                New to Batchion?{" "}
                <Link href="/register" className="text-[var(--accent-primary)] hover:underline font-medium transition-colors">
                  Create an account
                </Link>
              </p>
            </div>
          </div>

          {/* Additional Help */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="hover:text-[var(--text-secondary)] underline transition-colors">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="hover:text-[var(--text-secondary)] underline transition-colors">
                Privacy Policy
              </Link>
            </p>
          </div>

          {/* Security Notice */}
          <div className="mt-4 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">
              🔒 Your data is encrypted and secure
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
