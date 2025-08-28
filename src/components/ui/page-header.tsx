"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "./logo";
import { UserProfile } from "@/components/auth/user-profile";

interface PageHeaderProps {
  /** Whether to show back navigation */
  showBack?: boolean;
  /** Back navigation URL */
  backUrl?: string;
  /** Page title to display */
  title?: string;
  /** Whether this is a dashboard page (affects logo size/layout) */
  isDashboard?: boolean;
  /** Custom logo className */
  logoClassName?: string;
}

export function PageHeader({
  showBack = false,
  backUrl = "/dashboard",
  title,
  isDashboard = false,
  logoClassName = "h-8 w-32",
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-6">
            {showBack && (
              <Link href={backUrl} className="flex items-center gap-3 transition-opacity hover:opacity-80">
                <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
                <div className="flex items-center gap-3">
                  <Logo className={logoClassName} />
                </div>
              </Link>
            )}
            {!showBack && (
              <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
                <Logo className={logoClassName} />
              </Link>
            )}

            {/* Breadcrumb separator */}
            {showBack && title && (
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
