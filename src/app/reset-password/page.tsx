"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/utils/supabase/client";
import { Eye, EyeOff, Lock, ArrowLeft, Loader2, Play, CheckCircle2, AlertCircle, X, RefreshCw } from "lucide-react";

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [sessionEstablished, setSessionEstablished] = useState(false);

  // Get tokens from URL - Supabase sends these in the URL fragment after email click
  const getTokensFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return { accessToken: null, refreshToken: null, tokenType: null, error: null, errorCode: null, errorDescription: null };
    
    // Check URL hash first (most common for Supabase password reset)
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    
    // Check search params as fallback and for error handling
    const searchAccessToken = searchParams.get('access_token');
    const searchRefreshToken = searchParams.get('refresh_token');
    const searchTokenType = searchParams.get('token_type');
    const searchError = searchParams.get('error');
    const searchErrorCode = searchParams.get('error_code');
    const searchErrorDescription = searchParams.get('error_description');
    
    // Also check for code parameter (sometimes Supabase uses this)
    const codeParam = searchParams.get('code');
    const codeVerifier = searchParams.get('code_verifier');
    
    return {
      accessToken: hashParams.get('access_token') || searchAccessToken,
      refreshToken: hashParams.get('refresh_token') || searchRefreshToken,
      tokenType: hashParams.get('token_type') || searchTokenType || 'bearer',
      code: codeParam,
      codeVerifier: codeVerifier,
      error: hashParams.get('error') || searchError,
      errorCode: hashParams.get('error_code') || searchErrorCode,
      errorDescription: hashParams.get('error_description') || searchErrorDescription
    };
  }, [searchParams]);

  // Token validation effect
  useEffect(() => {
    const validateTokenAndSetSession = async () => {
      // Debug info in development
      const tokens = getTokensFromUrl();
      console.log('🔍 Debug Token Info:', {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
        hasCode: !!tokens.code,
        hasCodeVerifier: !!tokens.codeVerifier,
        hasError: !!tokens.error,
        errorCode: tokens.errorCode,
        errorDescription: tokens.errorDescription,
        url: window.location.href,
        hash: window.location.hash,
        search: window.location.search,
        accessTokenPreview: tokens.accessToken ? tokens.accessToken.substring(0, 20) + '...' : 'none',
        codePreview: tokens.code ? tokens.code.substring(0, 20) + '...' : 'none',
        codeVerifierPreview: tokens.codeVerifier ? tokens.codeVerifier.substring(0, 20) + '...' : 'none'
      });
      
      const { accessToken, refreshToken, tokenType, code, codeVerifier, error: urlError, errorCode, errorDescription } = getTokensFromUrl();
      
      // Check for explicit errors in URL first
      if (urlError) {
        console.error('Password reset URL error:', { error: urlError, errorCode, errorDescription });
        
        let errorMessage = "Password reset failed.";
        
        switch (errorCode) {
          case 'otp_expired':
            errorMessage = "The password reset link has expired. Please request a new one.";
            break;
          case 'access_denied':
            errorMessage = "Access denied. The reset link may be invalid or expired.";
            break;
          case 'invalid_request':
            errorMessage = "Invalid reset request. Please try requesting a new reset link.";
            break;
          default:
            if (errorDescription) {
              // Decode URL-encoded error description
              errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
            }
        }
        
        setError(errorMessage);
        setIsValidatingToken(false);
        setTokenValid(false);
        return;
      }
      
      // Check for access token or code parameter
      if (!accessToken && !code) {
        // If there are no tokens but also no explicit error, this might be a configuration issue
        console.warn('No tokens found in URL. This could indicate a Supabase configuration issue.');
        setError("No reset token found in the URL. This could be due to a configuration issue or the link format has changed. Please request a new password reset.");
        setIsValidatingToken(false);
        return;
      }

      try {
        let sessionResult;
        
        // Try different approaches based on what we have
        if (accessToken) {
          // Standard token-based approach
          console.log('Attempting to set session with access token');
          sessionResult = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
        } else if (code) {
          // Code-based approach - handle PKCE vs non-PKCE flows
          console.log('Attempting to verify OTP with code');
          
          // First try verifyOtp (works for most configurations)
          sessionResult = await supabase.auth.verifyOtp({
            token_hash: code,
            type: 'recovery'
          });
          
          // If that fails with PKCE error, the issue is configuration-related
          if (sessionResult?.error) {
            console.log('verifyOtp failed:', sessionResult.error);
            
            // For PKCE configurations, password reset might need special handling
            if (sessionResult.error.message.includes('invalid') || sessionResult.error.message.includes('expired')) {
              // This is likely a legitimate expiry/invalid token
              console.log('Token appears to be genuinely invalid or expired');
            } else {
              // Try exchangeCodeForSession as fallback (though it will likely fail without code_verifier)
              console.log('Trying exchangeCodeForSession as fallback');
              try {
                sessionResult = await supabase.auth.exchangeCodeForSession(code);
              } catch (exchangeError) {
                console.log('exchangeCodeForSession also failed:', exchangeError);
                // Keep the original verifyOtp error for user display
              }
            }
          }
        }

        if (sessionResult?.error || !sessionResult?.data?.session) {
          console.error('Session establishment error:', sessionResult?.error);
          
          // Provide more specific error messages based on the error
          let errorMessage = "Invalid or expired reset token. Please request a new password reset.";
          
          if (sessionResult?.error?.message) {
            const errorMsg = sessionResult.error.message.toLowerCase();
            if (errorMsg.includes('expired') || errorMsg.includes('invalid')) {
              errorMessage = "The password reset link has expired or is invalid. Reset links expire after 1 hour for security. Please request a new one.";
            } else if (errorMsg.includes('used') || errorMsg.includes('consumed')) {
              errorMessage = "This reset link has already been used. Please request a new one if you need to reset your password again.";
            } else if (errorMsg.includes('email link is invalid or has expired')) {
              errorMessage = "This password reset link has expired. Reset links are only valid for 1 hour. Please request a new reset link.";
            } else if (errorMsg.includes('both auth code and code verifier should be non-empty')) {
              errorMessage = "Configuration issue: Your Supabase project uses PKCE but password reset emails don't include the required code verifier. Please contact support or check your Supabase auth configuration.";
            }
          }
          
          setError(errorMessage);
          setTokenValid(false);
        } else {
          // Verify the session was established correctly
          const { data: { session }, error: getSessionError } = await supabase.auth.getSession();
          
          if (getSessionError || !session) {
            console.error('Get session error:', getSessionError);
            setError("Failed to establish reset session. Please request a new password reset.");
            setTokenValid(false);
          } else {
            console.log('Password reset session established successfully');
            setTokenValid(true);
            setSessionEstablished(true);
          }
        }
      } catch (err) {
        console.error('Token validation error:', err);
        setError("Failed to validate reset token. Please try again.");
        setTokenValid(false);
      } finally {
        setIsValidatingToken(false);
      }
    };

    validateTokenAndSetSession();
  }, [supabase.auth, getTokensFromUrl]);

  // Password strength calculation
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

  // Enhanced password validation
  const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }
    if (password.length > 128) {
      errors.push("Password must be less than 128 characters long");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    if (/^(.)\1+$/.test(password)) {
      errors.push("Password cannot be all the same character");
    }
    if (/(.{3,})\1/.test(password)) {
      errors.push("Password cannot contain repeating patterns");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Clear error when user starts typing
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError(null);
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Verify session is still valid
    if (!sessionEstablished) {
      setError("Reset session expired. Please request a new password reset.");
      return;
    }

    // Client-side validation
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

    setLoading(true);

    try {
      // Double-check session before password update
      const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
      
      if (sessionCheckError || !session) {
        setError("Reset session expired. Please request a new password reset.");
        return;
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        // Handle specific Supabase errors
        switch (updateError.message) {
          case "New password should be different from the old password":
            setError("New password must be different from your current password.");
            break;
          case "Password should be at least 6 characters":
            setError("Password must be at least 6 characters long.");
            break;
          case "Auth session missing!":
            setError("Reset session expired. Please request a new password reset.");
            break;
          default:
            setError(updateError.message || "Failed to update password. Please try again.");
        }
        return;
      }

      setSuccess(true);
      
      // Clear the URL hash to prevent reuse
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      // Redirect to dashboard after success (user is now authenticated)
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);

    } catch (err) {
      console.error('Password update error:', err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Retry token validation
  const retryValidation = () => {
    setError(null);
    setIsValidatingToken(true);
    setTokenValid(false);
    setSessionEstablished(false);
    
    // Trigger re-validation
    window.location.reload();
  };

  // Show loading state while validating token
  if (isValidatingToken) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Validating reset link...</span>
        </div>
      </div>
    );
  }

  // Show error state for invalid token
  if (!isValidatingToken && !tokenValid && error) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex flex-col">
        {/* Header */}
        <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
            <Link href="/forgot-password" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] rounded-lg flex items-center justify-center">
                  <Play className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold">GraphBatch</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Error State */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-8 backdrop-blur-sm shadow-[var(--glass-shadow-lg)] text-center">
              <div className="w-16 h-16 bg-[var(--danger-500)] rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
                Invalid Reset Link
              </h1>
              
              <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
                {error}
              </p>

              <div className="space-y-3">
                <Link 
                  href="/forgot-password"
                  className="w-full block py-3 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  🔄 Request New Reset Link
                </Link>
                
                <button 
                  onClick={retryValidation}
                  className="w-full py-3 border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-2)] transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>

              <div className="mt-6 p-4 bg-[var(--surface-1)] rounded-lg border border-[var(--border-primary)]">
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Why this happens:</h3>
                <ul className="text-xs text-[var(--text-secondary)] space-y-1">
                  <li>• Reset links expire after 1 hour for security</li>
                  <li>• Each reset link can only be used once</li>
                  <li>• Switching browsers/devices can cause issues</li>
                  <li>• Opening multiple tabs with the same link</li>
                  <li>• Supabase redirect URL configuration mismatch</li>
                </ul>
                
                <div className="mt-3 p-2 bg-[var(--accent-primary)]/10 rounded border border-[var(--accent-primary)]/20">
                  <p className="text-xs text-[var(--accent-primary)] font-medium">
                    💡 Solution: Request a fresh reset link and use it immediately in the same browser.
                  </p>
                </div>
                
                {error?.includes('PKCE') && (
                  <div className="mt-3 p-2 bg-[var(--warning-500)]/10 rounded border border-[var(--warning-500)]/20">
                    <p className="text-xs text-[var(--warning-500)] font-medium">
                      🔧 PKCE Configuration Issue: Your Supabase project needs auth flow adjustment for password resets.
                    </p>
                  </div>
                )}
                
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-3 p-2 bg-[var(--warning-500)]/10 rounded border border-[var(--warning-500)]/20">
                    <p className="text-xs text-[var(--warning-500)] font-medium">
                      🔧 Dev Note: Check browser console for debug info. Ensure Supabase redirect URLs include: {window.location.origin}/reset-password
                    </p>
                  </div>
                )}
              </div>

              {/* Debug Info in Development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-3 bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 rounded-lg">
                  <h3 className="text-xs font-medium text-[var(--danger-500)] mb-2">Debug Info:</h3>
                  <div className="text-xs text-[var(--text-secondary)] space-y-1 font-mono">
                    <div>URL: {typeof window !== 'undefined' ? window.location.href : 'SSR'}</div>
                    <div>Hash: {typeof window !== 'undefined' ? window.location.hash || '(empty)' : 'SSR'}</div>
                    <div>Search: {typeof window !== 'undefined' ? window.location.search || '(empty)' : 'SSR'}</div>
                  </div>
                </div>
              )}

              <div className="mt-4 text-center">
                <p className="text-xs text-[var(--text-tertiary)]">
                  Still having trouble?{" "}
                  <Link href="/login" className="hover:text-[var(--text-secondary)] underline">
                    Back to Sign In
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex flex-col">
        {/* Header */}
        <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold">GraphBatch</span>
            </div>
          </div>
        </header>

        {/* Success State */}
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
                Your password has been updated. You will be automatically redirected to your dashboard.
              </p>

              <div className="space-y-3">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold">GraphBatch</span>
            </div>
          </Link>
          
          <div className="text-sm text-[var(--text-secondary)]">
            Remember your password?{" "}
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
                Reset your password
              </h1>
              <p className="text-[var(--text-secondary)]">
                Enter your new password below.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Password Field */}
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
                    onChange={handlePasswordChange}
                    className="w-full pl-10 pr-12 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Create a strong password"
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
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
                          className={`h-1 rounded-full flex-1 transition-colors duration-200 ${
                            i < passwordStrength.score
                              ? passwordStrength.color === "var(--success-500)" 
                                ? "bg-[var(--success-500)]"
                                : passwordStrength.color === "var(--warning-500)"
                                ? "bg-[var(--warning-500)]"
                                : "bg-[var(--danger-500)]"
                              : "bg-[var(--surface-2)]"
                          }`}
                        />
                      ))}
                    </div>
                    
                    {passwordStrength.feedback.length > 0 && (
                      <div className="text-xs text-[var(--text-tertiary)]">
                        <span className="font-medium">Password must include: </span>
                        {passwordStrength.feedback.join(", ")}
                      </div>
                    )}
                    
                    {passwordStrength.score >= 4 && (
                      <div className="text-xs text-[var(--success-500)] font-medium">
                        ✓ Strong password
                      </div>
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
                    onChange={handleConfirmPasswordChange}
                    className="w-full pl-10 pr-12 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Confirm your new password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
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
                        <span className="text-[var(--success-500)] font-medium">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-[var(--danger-500)]" />
                        <span className="text-[var(--danger-500)] font-medium">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
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
                disabled={loading || !sessionEstablished || passwordStrength.score < 3 || password !== confirmPassword}
                className="w-full py-3 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
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
            </form>

            {/* Divider */}
            <div className="mt-8 pt-6 border-t border-[var(--border-primary)]">
              <p className="text-center text-sm text-[var(--text-secondary)]">
                Remember your password?{" "}
                <Link href="/login" className="text-[var(--accent-primary)] hover:underline font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Additional Help */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">
              Having trouble?{" "}
              <Link href="/forgot-password" className="hover:text-[var(--text-secondary)] underline transition-colors">
                Request a new reset link
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
