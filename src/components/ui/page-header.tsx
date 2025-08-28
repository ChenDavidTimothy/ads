"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "./button";
import Logo from "./logo";
import { UserProfile } from "@/components/auth/user-profile";

interface PageHeaderProps {
  /** Whether to show back navigation */
  showBack?: boolean;
  /** Page title to display */
  title?: string;
  /** Whether this is a dashboard page (affects logo size/layout) */
  isDashboard?: boolean;
  /** Custom logo className */
  logoClassName?: string;
}

export function PageHeader({
  showBack = false,
  title,
  isDashboard = false,
  logoClassName = "h-8 w-32",
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    // Check if there's browser history to go back to
    if (window.history.length > 1) {
      router.back();
    } else {
      // Fallback to dashboard if no history
      router.push("/dashboard");
    }
  };

  const handleLogoClick = (href: string) => {
    // Check if there's a guarded router available (when workspace has unsaved changes)
    const guardedRouter = (window as any).__guardedRouter;
    if (guardedRouter) {
      guardedRouter.push(href);
    } else {
      router.push(href);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Navigation Section */}
          <div className="flex items-center gap-6">
            {/* Back Button */}
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </Button>
            )}

            {/* Logo - Always goes to dashboard */}
            <button
              onClick={() => handleLogoClick(isDashboard ? "/" : "/dashboard")}
              className="flex items-center gap-3 transition-opacity hover:opacity-80 cursor-pointer"
            >
              <Logo className={logoClassName} />
            </button>

            {/* Breadcrumb separator */}
            {title && (
              <>
                <div className="text-[var(--text-tertiary)]">/</div>
                <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                  {title}
                </h1>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <UserProfile />
          </div>
        </div>
      </div>
    </header>
  );
}
