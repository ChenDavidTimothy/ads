"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/form-fields";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import { useWorkspaceOperations } from "@/hooks/use-workspace-operations";
import type { RouterOutputs } from "@/trpc/react";
import {
  Plus,
  Search,
  MoreVertical,
  FolderOpen,
  Users,
  Play,
  Clock,
  Trash2,
  Edit3,
  Copy,
  Activity,
  TrendingUp,
  Video,
  Loader2,
  Star,
  Grid,
  List,
  Download,
  Share2,
  Archive,
  Eye,
  AlertCircle,
} from "lucide-react";

type Workspace = RouterOutputs["workspace"]["list"][number];

interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

interface WorkspaceCategory {
  id: string;
  name: string;
  count: number;
  icon: React.ReactNode;
}

export default function DashboardPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const { toast } = useNotifications();
  const { duplicate, delete: deleteOp, rename } = useWorkspaceOperations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    data: workspaces,
    isLoading,
    isError,
    refetch,
  } = api.workspace.list.useQuery(undefined, { retry: false });
  const createWorkspace = api.workspace.create.useMutation({
    onSuccess: async (ws) => {
      await utils.workspace.list.invalidate();
      setNewWorkspaceName("");
      setSelectedTemplate(null);
      setShowCreateForm(false);
      router.push(`/workspace?workspace=${ws.id}`);
    },
  });

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(
    null,
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] =
    useState<WorkspaceTemplate | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // Rename modal state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameWorkspaceId, setRenameWorkspaceId] = useState<string | null>(
    null,
  );
  const [renameWorkspaceName, setRenameWorkspaceName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [sortBy, setSortBy] = useState<"name" | "updated" | "created">(
    "updated",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Workspace templates
  const workspaceTemplates: WorkspaceTemplate[] = [
    {
      id: "social-media",
      name: "Social Media Ad",
      description: "Perfect for Instagram, Facebook, and TikTok campaigns",
      icon: <Video className="h-5 w-5" />,
      category: "marketing",
    },
    {
      id: "product-demo",
      name: "Product Demo",
      description: "Showcase your product features and benefits",
      icon: <Play className="h-5 w-5" />,
      category: "sales",
    },
    {
      id: "educational",
      name: "Educational Content",
      description: "Create tutorials and explainer videos",
      icon: <Users className="h-5 w-5" />,
      category: "content",
    },
    {
      id: "brand-story",
      name: "Brand Story",
      description: "Tell your company's story and mission",
      icon: <Star className="h-5 w-5" />,
      category: "branding",
    },
    {
      id: "data-visualization",
      name: "Data Visualization",
      description: "Transform data into compelling visual stories",
      icon: <TrendingUp className="h-5 w-5" />,
      category: "analytics",
    },
    {
      id: "custom",
      name: "Custom Template",
      description: "Start with a blank canvas",
      icon: <Plus className="h-5 w-5" />,
      category: "custom",
    },
  ];

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showWorkspaceMenu &&
        !(event.target as Element).closest(".workspace-menu")
      ) {
        setShowWorkspaceMenu(false);
        setSelectedWorkspace(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showWorkspaceMenu]);

  // Close menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (showWorkspaceMenu) {
        setShowWorkspaceMenu(false);
        setSelectedWorkspace(null);
      }
    };

    if (showWorkspaceMenu) {
      window.addEventListener("scroll", handleScroll, true);
      return () => window.removeEventListener("scroll", handleScroll, true);
    }
  }, [showWorkspaceMenu]);

  // Helper functions
  const isRecent = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  // Categories with dynamic counts
  const categories: WorkspaceCategory[] = useMemo(() => {
    if (!workspaces) return [];

    const allCount = workspaces.length;
    const recentCount = workspaces.filter((ws) =>
      isRecent(ws.updated_at),
    ).length;
    // Remove status-based filtering since status property doesn't exist
    const activeCount = workspaces.length; // All workspaces are considered active
    const archivedCount = 0; // No archived workspaces in current schema

    return [
      {
        id: "all",
        name: "All Workspaces",
        count: allCount,
        icon: <FolderOpen className="h-4 w-4" />,
      },
      {
        id: "recent",
        name: "Recently Updated",
        count: recentCount,
        icon: <Clock className="h-4 w-4" />,
      },
      {
        id: "active",
        name: "Active Projects",
        count: activeCount,
        icon: <Activity className="h-4 w-4" />,
      },
      {
        id: "archived",
        name: "Archived",
        count: archivedCount,
        icon: <Archive className="h-4 w-4" />,
      },
    ];
  }, [workspaces]);

  // Filter and sort workspaces
  const filteredWorkspaces = useMemo(() => {
    if (!workspaces) return [];

    const filtered = workspaces.filter((ws: Workspace) => {
      const matchesSearch = ws.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" ||
        (selectedCategory === "recent" && isRecent(ws.updated_at)) ||
        (selectedCategory === "active" && true) || // All workspaces are active
        (selectedCategory === "archived" && false); // No archived workspaces

      return matchesSearch && matchesCategory;
    });

    // Sort workspaces
    const sorted = [...filtered].sort((a: Workspace, b: Workspace) => {
      let aValue: string | Date;
      let bValue: string | Date;

      switch (sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "created":
          // Use updated_at since created_at doesn't exist in list schema
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
        case "updated":
        default:
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [workspaces, searchQuery, selectedCategory, sortBy, sortOrder]);

  const recentWorkspaces = useMemo(() => {
    return filteredWorkspaces.slice(0, 3);
  }, [filteredWorkspaces]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Event handlers
  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    const templateData = selectedTemplate
      ? {
          template_id: selectedTemplate.id,
          template_name: selectedTemplate.name,
        }
      : {};

    createWorkspace.mutate({
      name: newWorkspaceName.trim(),
      ...templateData,
    });
  };

  const handleWorkspaceAction = async (action: string, workspaceId: string) => {
    switch (action) {
      case "open":
        router.push(`/workspace?workspace=${workspaceId}`);
        break;

      case "duplicate":
        duplicate.mutate(workspaceId);
        break;

      case "delete":
        // Get workspace name for confirmation
        const workspace = workspaces?.find((ws) => ws.id === workspaceId);
        const workspaceName = workspace?.name ?? "this workspace";

        if (
          window.confirm(
            `Are you sure you want to delete "${workspaceName}"?\n\nThis action cannot be undone and all data will be permanently lost.`,
          )
        ) {
          deleteOp.mutate(workspaceId);
        }
        break;

      case "rename":
        openRenameModal(workspaceId);
        break;

      case "archive":
        // TODO: Implement archive functionality
        console.log("Archive workspace:", workspaceId);
        toast.info("Archive functionality coming soon");
        break;
    }

    setShowWorkspaceMenu(false);
    setSelectedWorkspace(null);
  };

  // Rename modal handlers
  const openRenameModal = (workspaceId: string) => {
    const workspace = workspaces?.find((ws) => ws.id === workspaceId);
    if (workspace) {
      setRenameWorkspaceId(workspaceId);
      setRenameWorkspaceName(workspace.name);
      setShowRenameModal(true);

      // Focus the input when modal opens
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 100);
    }
  };

  const closeRenameModal = () => {
    setShowRenameModal(false);
    setRenameWorkspaceId(null);
    setRenameWorkspaceName("");
  };

  const handleRenameWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameWorkspaceId || !renameWorkspaceName.trim()) return;

    rename.mutate(renameWorkspaceId, renameWorkspaceName.trim());
    closeRenameModal();
  };

  const openWorkspaceMenu = (e: React.MouseEvent, workspaceId: string) => {
    e.stopPropagation();
    setSelectedWorkspace(workspaceId);
    setShowWorkspaceMenu(true);
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const selectTemplate = (template: WorkspaceTemplate) => {
    setSelectedTemplate(template);
    setNewWorkspaceName(template.name);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      {/* Header */}
      <PageHeader />

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-[var(--text-primary)]">
            Welcome back
          </h1>
          <p className="text-[var(--text-secondary)]">
            Manage your animation workspaces and create stunning video content.
          </p>
        </div>

        {/* Actions Bar */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="max-w-md flex-1">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-[var(--text-tertiary)]" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search workspaces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              Refresh
            </Button>

            <Button variant="primary" onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Workspace
            </Button>
          </div>
        </div>

        {/* Create Workspace Form */}
        {showCreateForm && (
          <div className="mb-8 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Create New Workspace
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewWorkspaceName("");
                  setSelectedTemplate(null);
                }}
              >
                ×
              </Button>
            </div>

            {/* Template Selection */}
            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium text-[var(--text-secondary)]">
                Choose a template (optional)
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {workspaceTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant={
                      selectedTemplate?.id === template.id ? "primary" : "ghost"
                    }
                    size="lg"
                    className="h-auto justify-start p-4 text-left"
                    onClick={() => selectTemplate(template)}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="text-[var(--accent-primary)]">
                        {template.icon}
                      </div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {template.name}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {template.description}
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateWorkspace} className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Enter workspace name..."
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  autoFocus
                  maxLength={100}
                />
              </div>
              <Button
                type="submit"
                disabled={createWorkspace.isPending || !newWorkspaceName.trim()}
              >
                {createWorkspace.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create"
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewWorkspaceName("");
                  setSelectedTemplate(null);
                }}
              >
                Cancel
              </Button>
            </form>
          </div>
        )}

        {/* Category Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "primary" : "ghost"}
              size="sm"
              className={cn(
                "rounded-none border-b-2",
                selectedCategory === category.id
                  ? "border-[var(--accent-primary)]"
                  : "border-transparent",
              )}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.icon}
              {category.name} ({category.count})
            </Button>
          ))}
        </div>

        {/* View Controls and Sorting */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-[var(--surface-2)] p-1">
              <Button
                variant={viewMode === "grid" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="rounded-md"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-md"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)]">
                Sort by:
              </span>
              <div className="w-48">
                <SelectField
                  label={<span className="sr-only">Sort by</span>}
                  value={sortBy}
                  onChange={(v) =>
                    setSortBy(v as "name" | "updated" | "created")
                  }
                  options={[
                    { value: "updated", label: "Last Updated" },
                    { value: "created", label: "Date Created" },
                    { value: "name", label: "Name" },
                  ]}
                  required={false}
                  className="!space-y-0"
                />
              </div>
              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="cursor-pointer rounded p-1 transition-colors hover:bg-[var(--surface-interactive)]"
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>

          <div className="text-sm text-[var(--text-tertiary)]">
            {filteredWorkspaces.length} workspace
            {filteredWorkspaces.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Content */}
        {isError ? (
          <div className="py-12 text-center">
            <div className="inline-block rounded-lg border border-[var(--danger-500)]/20 bg-[var(--danger-500)]/10 p-6">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-[var(--danger-500)]" />
              <p className="mb-4 font-medium text-[var(--danger-500)]">
                Failed to load workspaces
              </p>
              <Button onClick={() => refetch()} variant="secondary">
                Try Again
              </Button>
            </div>
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="py-12 text-center">
            {searchQuery || selectedCategory !== "all" ? (
              <div className="inline-block rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] p-8">
                <Search className="mx-auto mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
                <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
                  No workspaces found
                </h3>
                <p className="mb-4 text-[var(--text-secondary)]">
                  Try adjusting your search terms or filters.
                </p>
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                  variant="secondary"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="inline-block rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] p-8">
                <FolderOpen className="mx-auto mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
                <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
                  No workspaces yet
                </h3>
                <p className="mb-4 text-[var(--text-secondary)]">
                  Create your first workspace to start building animations.
                </p>
                <Button
                  variant="primary"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workspace
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Recent Workspaces */}
            {!searchQuery &&
              selectedCategory === "all" &&
              recentWorkspaces.length > 0 && (
                <div className="mb-8">
                  <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                    Recent Workspaces
                  </h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {recentWorkspaces.map((workspace) => (
                      <div
                        key={workspace.id}
                        className="group cursor-pointer rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 backdrop-blur-sm transition-all hover:border-[var(--accent-primary)]"
                        onClick={() =>
                          router.push(`/workspace?workspace=${workspace.id}`)
                        }
                      >
                        <div className="mb-4 flex items-start justify-between">
                          <Button
                            variant="primary"
                            size="sm"
                            className="h-10 w-10 rounded-lg p-0"
                          >
                            <Play className="h-5 w-5" />
                          </Button>
                          <button
                            className="cursor-pointer rounded p-1 opacity-100 hover:bg-[var(--surface-2)]"
                            onClick={(e) => openWorkspaceMenu(e, workspace.id)}
                          >
                            <MoreVertical className="h-4 w-4 text-[var(--text-tertiary)]" />
                          </button>
                        </div>

                        <h3 className="mb-2 font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                          {workspace.name}
                        </h3>

                        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(workspace.updated_at)}
                          </div>
                          {/* Removed video_count and size as they don't exist */}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* All Workspaces */}
            <div>
              <h2 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
                {searchQuery
                  ? `Search Results (${filteredWorkspaces.length})`
                  : selectedCategory !== "all"
                    ? `${categories.find((c) => c.id === selectedCategory)?.name} (${filteredWorkspaces.length})`
                    : "All Workspaces"}
              </h2>

              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredWorkspaces.map((workspace) => (
                    <div
                      key={workspace.id}
                      className="group cursor-pointer rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 backdrop-blur-sm transition-all hover:border-[var(--accent-primary)]"
                      onClick={() =>
                        router.push(`/workspace?workspace=${workspace.id}`)
                      }
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-10 w-10 rounded-lg p-0"
                        >
                          <Play className="h-5 w-5" />
                        </Button>
                        <button
                          className="cursor-pointer rounded p-1 opacity-100 hover:bg-[var(--surface-2)]"
                          onClick={(e) => openWorkspaceMenu(e, workspace.id)}
                        >
                          <MoreVertical className="h-4 w-4 text-[var(--text-tertiary)]" />
                        </button>
                      </div>

                      <h3 className="mb-2 font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                        {workspace.name}
                      </h3>

                      <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last updated {formatDate(workspace.updated_at)}
                        </div>
                        {/* Removed video_count and size as they don't exist */}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)]">
                  {filteredWorkspaces.map((workspace, index) => (
                    <div
                      key={workspace.id}
                      className={`group flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-[var(--surface-interactive)] ${
                        index !== filteredWorkspaces.length - 1
                          ? "border-b border-[var(--border-primary)]"
                          : ""
                      }`}
                      onClick={() =>
                        router.push(`/workspace?workspace=${workspace.id}`)
                      }
                    >
                      <div className="flex flex-1 items-center gap-4">
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-10 w-10 flex-shrink-0 rounded-lg p-0"
                        >
                          <Play className="h-5 w-5" />
                        </Button>

                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
                            {workspace.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last updated {formatDate(workspace.updated_at)}
                            </div>
                            {/* Removed video_count and size as they don't exist */}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/workspace?workspace=${workspace.id}`);
                          }}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          Open
                        </Button>

                        <button
                          className="cursor-pointer rounded-lg p-2 opacity-100 hover:bg-[var(--surface-2)]"
                          onClick={(e) => openWorkspaceMenu(e, workspace.id)}
                        >
                          <MoreVertical className="h-4 w-4 text-[var(--text-tertiary)]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rename Workspace Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Rename Workspace
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeRenameModal}
                className="h-8 w-8 p-0"
              >
                ×
              </Button>
            </div>

            <form onSubmit={handleRenameWorkspace} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                  New workspace name
                </label>
                <Input
                  ref={renameInputRef}
                  type="text"
                  value={renameWorkspaceName}
                  onChange={(e) => setRenameWorkspaceName(e.target.value)}
                  placeholder="Enter workspace name..."
                  maxLength={100}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {renameWorkspaceName.length}/100 characters
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeRenameModal}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !renameWorkspaceName.trim() || rename.result.isLoading
                  }
                  className="flex-1"
                >
                  {rename.result.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Renaming...
                    </>
                  ) : (
                    "Rename"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workspace Actions Menu */}
      {showWorkspaceMenu && selectedWorkspace && (
        <div
          className="workspace-menu fixed z-50 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] shadow-lg backdrop-blur-sm"
          style={{
            left: menuPosition.x,
            top: menuPosition.y,
            transform: "translate(-50%, 10px)",
          }}
        >
          <div className="py-2">
            <button
              onClick={() => handleWorkspaceAction("open", selectedWorkspace)}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)]"
            >
              <Eye className="h-4 w-4" />
              Open
            </button>
            <button
              onClick={() =>
                handleWorkspaceAction("duplicate", selectedWorkspace)
              }
              disabled={duplicate.result.isLoading}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {duplicate.result.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {duplicate.result.isLoading ? "Duplicating..." : "Duplicate"}
            </button>
            <button
              onClick={() => handleWorkspaceAction("rename", selectedWorkspace)}
              disabled={rename.result.isLoading}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rename.result.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Edit3 className="h-4 w-4" />
              )}
              {rename.result.isLoading ? "Renaming..." : "Rename"}
            </button>
            <button
              onClick={() => handleWorkspaceAction("share", selectedWorkspace)}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)]"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button
              onClick={() =>
                handleWorkspaceAction("download", selectedWorkspace)
              }
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)]"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <div className="my-1 border-t border-[var(--border-primary)]"></div>
            <button
              onClick={() =>
                handleWorkspaceAction("archive", selectedWorkspace)
              }
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)]"
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
            <button
              onClick={() => handleWorkspaceAction("delete", selectedWorkspace)}
              disabled={deleteOp.result.isLoading}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteOp.result.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {deleteOp.result.isLoading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
