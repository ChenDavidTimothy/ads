"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "./button";
import Logo from "./logo";
import { UserProfile } from "@/components/auth/user-profile";
import { createBrowserClient } from "@/utils/supabase/client";

interface PageHeaderProps {
  /** Whether to show back navigation */
  showBack?: boolean;
  /** Page title to display */
  title?: string;
  /** Whether this is a dashboard page (affects logo size/layout) */
  isDashboard?: boolean;
  /** Custom logo className */
  logoClassName?: string;
  /** Custom right side navigation */
  rightNavigation?: React.ReactNode;
}

// Type for the guarded router available on window when there are unsaved changes
interface GuardedRouter {
  push: (url: string) => void;
  replace: (url: string) => void;
  back: () => void;
  forward: () => void;
}

declare global {
  interface Window {
    __guardedRouter?: GuardedRouter;
  }
}

export function PageHeader({
  showBack = false,
  title,
  isDashboard = false,
  logoClassName = "h-8 w-32",
  rightNavigation,
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

  const handleLogoClick = async (defaultHref: string) => {
    const guardedRouter = window.__guardedRouter;
    const route = guardedRouter ?? router;
    try {
      const supabase = createBrowserClient();
      const { data } = await supabase.auth.getSession();
      const isAuthed = Boolean(data.session?.user);
      const target = isAuthed ? defaultHref : "/";
      route.push(target);
    } catch {
      route.push(defaultHref);
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
              onClick={() => void handleLogoClick("/dashboard")}
              className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
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

          {/* Right Side Navigation */}
          <div className="flex items-center gap-4">
            {rightNavigation || <UserProfile />}
          </div>
        </div>
      </div>
    </header>
  );
}
