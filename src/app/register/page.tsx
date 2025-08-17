"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/utils/supabase/client";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Loader2, CheckCircle2, X, AlertCircle } from "lucide-react";
import Logo from "@/components/ui/logo";

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Get redirect URL from search params
  const redirectTo = searchParams.get('redirectTo');

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Redirect to the originally requested page or dashboard
          const destination = redirectTo && redirectTo.startsWith('/') ? redirectTo : "/dashboard";
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

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getPasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score += 1;
    else feedback.push("At least 8 characters");

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push("One lowercase letter");

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push("One uppercase letter");

    if (/\d/.test(password)) score += 1;
    else feedback.push("One number");

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push("One special character");

    let color = "var(--danger-500)";
    if (score >= 4) color = "var(--success-500)";
    else if (score >= 3) color = "var(--warning-500)";

    return { score, feedback, color };
  };

  const passwordStrength = getPasswordStrength(password);

  // Clear error when user starts typing
  const handleInputChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }

    if (!lastName.trim()) {
      setError("Last name is required");
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    if (passwordStrength.score < 3) {
      setError("Password is too weak. Please follow the requirements below.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!acceptTerms) {
      setError("Please accept the Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
          },
        },
      });

      if (signUpError) {
        // Provide user-friendly error messages
        switch (signUpError.message) {
          case "User already registered":
            setError("An account with this email already exists. Please sign in instead.");
            break;
          case "Password should be at least 6 characters":
            setError("Password must be at least 6 characters long.");
            break;
          case "Invalid email":
            setError("Please enter a valid email address.");
            break;
          default:
            setError(signUpError.message);
        }
        return;
      }

      setRegistrationSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
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

  // Show success state
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-8 backdrop-blur-sm shadow-[var(--glass-shadow-lg)] text-center">
            <div className="w-16 h-16 bg-[var(--success-500)] rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              Check your email
            </h1>
            
            <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
              We've sent a confirmation link to <strong>{email}</strong>. 
              Please check your email and click the link to activate your account.
            </p>

            <div className="space-y-3">
              <Link 
                href="/login"
                className="w-full block py-3 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-all"
              >
                Go to Sign In
              </Link>
              
              <button 
                onClick={() => setRegistrationSuccess(false)}
                className="w-full py-3 border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-2)] transition-colors"
              >
                Try Again
              </button>
            </div>

            <p className="text-xs text-[var(--text-tertiary)] mt-6">
              Didn't receive the email? Check your spam folder or contact support.
            </p>
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
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            <div className="flex items-center gap-3">
              <Logo className="w-32 h-8" />
            </div>
          </Link>
          
          <div className="text-sm text-[var(--text-secondary)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--accent-primary)] hover:underline font-medium transition-colors">
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
                Create your account
              </h1>
              <p className="text-[var(--text-secondary)]">
                Start creating stunning video content today
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="block text-sm font-medium text-[var(--text-primary)]">
                    First name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-[var(--text-tertiary)]" />
                    </div>
                    <input
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => handleInputChange(setFirstName, e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="John"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="lastName" className="block text-sm font-medium text-[var(--text-primary)]">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    value={lastName}
                    onChange={(e) => handleInputChange(setLastName, e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Doe"
                    disabled={loading}
                  />
                </div>
              </div>

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
                    onChange={(e) => handleInputChange(setEmail, e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="john@example.com"
                    disabled={loading}
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
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => handleInputChange(setPassword, e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Create a strong password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-[var(--text-tertiary)]" />
                    ) : (
                      <Eye className="h-5 w-5 text-[var(--text-tertiary)]" />
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="h-1 rounded-full flex-1 transition-colors"
                          style={{
                            backgroundColor: i < passwordStrength.score 
                              ? passwordStrength.color 
                              : 'var(--surface-2)'
                          }}
                        />
                      ))}
                    </div>
                    
                    {passwordStrength.feedback.length > 0 && (
                      <div className="text-xs text-[var(--text-tertiary)]">
                        <span>Password must include: </span>
                        {passwordStrength.feedback.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-primary)]">
                  Confirm password
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
                    onChange={(e) => handleInputChange(setConfirmPassword, e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Confirm your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-[var(--text-tertiary)]" />
                    ) : (
                      <Eye className="h-5 w-5 text-[var(--text-tertiary)]" />
                    )}
                  </button>
                </div>

                {/* Password Match Indicator */}
                {confirmPassword && (
                  <div className="flex items-center gap-2 text-xs">
                    {password === confirmPassword ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                        <span className="text-[var(--success-500)]">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-[var(--danger-500)]" />
                        <span className="text-[var(--danger-500)]">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Terms Acceptance */}
              <div className="flex items-start gap-3">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[var(--accent-primary)] border-[var(--border-primary)] rounded focus:ring-[var(--accent-primary)] focus:ring-2 focus:ring-offset-0 bg-[var(--glass-bg)]"
                  disabled={loading}
                />
                <label htmlFor="acceptTerms" className="text-sm text-[var(--text-secondary)] cursor-pointer">
                  I agree to the{" "}
                  <Link href="/terms" className="text-[var(--accent-primary)] hover:underline transition-colors">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-[var(--accent-primary)] hover:underline transition-colors">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-[var(--danger-500)] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[var(--danger-500)] font-medium">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !acceptTerms}
                className="w-full py-3 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="mt-8 pt-6 border-t border-[var(--border-primary)]">
              <p className="text-center text-sm text-[var(--text-secondary)]">
                Already have an account?{" "}
                <Link href="/login" className="text-[var(--accent-primary)] hover:underline font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Additional Help */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">
              By creating an account, you agree to our{" "}
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
