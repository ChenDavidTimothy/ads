"use client";

import { WorkspaceTabs } from "./workspace-tabs";
import { useWorkspace } from "./workspace-context";
import { Button } from "@/components/ui/button";
import { PanelLeft, PanelRight } from "lucide-react";
import Logo from "@/components/ui/logo";
import { UserProfile } from "@/components/auth/user-profile";
import Link from "next/link";

export function WorkspaceHeader() {
  const { state, updateUI } = useWorkspace();

  return (
    <div className="flex h-14 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--surface-1)] px-[var(--space-4)]">
      <div className="flex items-center gap-[var(--space-4)]">
        {/* Left Sidebar Toggle */}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Toggle left sidebar"
          onClick={() =>
            updateUI({ leftSidebarCollapsed: !state.ui.leftSidebarCollapsed })
          }
        >
          <PanelLeft size={16} />
        </Button>

        {/* Brand Logo - Links back to dashboard */}
        <Link
          href="/dashboard"
          className="flex flex-shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Logo className="h-8 w-32" />
        </Link>

        {/* Workspace Tabs */}
        <WorkspaceTabs />
      </div>

      <h1 className="max-w-[300px] truncate text-lg font-semibold text-[var(--text-primary)]">
        {state.meta.name}
      </h1>

      <div className="flex items-center gap-[var(--space-3)]">
        <UserProfile />
        <Button
          variant="ghost"
          size="sm"
          aria-label="Toggle right sidebar"
          onClick={() =>
            updateUI({ rightSidebarCollapsed: !state.ui.rightSidebarCollapsed })
          }
        >
          <PanelRight size={16} />
        </Button>
      </div>
    </div>
  );
}
