"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthStatus } from "@/components/auth/auth-status";
import type { RouterOutputs } from "@/trpc/react";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  FolderOpen, 
  Calendar, 
  Users, 
  Settings, 
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
  Tag,
  Filter,
  Grid,
  List,
  Download,
  Share2,
  Archive,
  Eye,
  EyeOff,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Info
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { data: workspaces, isLoading, isError, refetch } = api.workspace.list.useQuery();
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
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkspaceTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Workspace templates
  const workspaceTemplates: WorkspaceTemplate[] = [
    { 
      id: 'social-media', 
      name: "Social Media Ad", 
      description: "Perfect for Instagram, Facebook, and TikTok campaigns",
      icon: <Video className="w-5 h-5" />,
      category: 'marketing'
    },
    { 
      id: 'product-demo', 
      name: "Product Demo", 
      description: "Showcase your product features and benefits",
      icon: <Play className="w-5 h-5" />,
      category: 'sales'
    },
    { 
      id: 'educational', 
      name: "Educational Content", 
      description: "Create tutorials and explainer videos",
      icon: <Users className="w-5 h-5" />,
      category: 'content'
    },
    { 
      id: 'brand-story', 
      name: "Brand Story", 
      description: "Tell your company's story and mission",
      icon: <Star className="w-5 h-5" />,
      category: 'branding'
    },
    { 
      id: 'data-visualization', 
      name: "Data Visualization", 
      description: "Transform data into compelling visual stories",
      icon: <TrendingUp className="w-5 h-5" />,
      category: 'analytics'
    },
    { 
      id: 'custom', 
      name: "Custom Template", 
      description: "Start with a blank canvas",
      icon: <Plus className="w-5 h-5" />,
      category: 'custom'
    }
  ];



  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showWorkspaceMenu && !(event.target as Element).closest('.workspace-menu')) {
        setShowWorkspaceMenu(false);
        setSelectedWorkspace(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    const recentCount = workspaces.filter(ws => isRecent(ws.updated_at)).length;
    const activeCount = workspaces.filter(ws => ws.status === 'active' || !ws.status).length;
    const archivedCount = workspaces.filter(ws => ws.status === 'archived').length;

    return [
      { id: 'all', name: 'All Workspaces', count: allCount, icon: <FolderOpen className="w-4 h-4" /> },
      { id: 'recent', name: 'Recently Updated', count: recentCount, icon: <Clock className="w-4 h-4" /> },
      { id: 'active', name: 'Active Projects', count: activeCount, icon: <Activity className="w-4 h-4" /> },
      { id: 'archived', name: 'Archived', count: archivedCount, icon: <Archive className="w-4 h-4" /> }
    ];
  }, [workspaces]);

  // Enhanced statistics
  const workspaceStats = useMemo(() => {
    if (!workspaces) return null;
    
    const totalVideos = workspaces.reduce((sum, ws) => sum + (ws.video_count || 0), 0);
    const thisMonth = workspaces.filter(ws => {
      const date = new Date(ws.updated_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    const totalSize = workspaces.reduce((sum, ws) => sum + (ws.size || 0), 0);
    const activeProjects = workspaces.filter(ws => ws.status === 'active' || !ws.status).length;
    
    return { totalVideos, thisMonth, totalSize, activeProjects };
  }, [workspaces]);

  // Filter and sort workspaces
  const filteredWorkspaces = useMemo(() => {
    if (!workspaces) return [];
    
    let filtered = workspaces.filter((ws: Workspace) => {
      const matchesSearch = ws.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || 
        (selectedCategory === 'recent' && isRecent(ws.updated_at)) ||
        (selectedCategory === 'active' && (ws.status === 'active' || !ws.status)) ||
        (selectedCategory === 'archived' && ws.status === 'archived');
      
      return matchesSearch && matchesCategory;
    });
    
    // Sort workspaces
    filtered.sort((a: Workspace, b: Workspace) => {
      let aValue: string | Date;
      let bValue: string | Date;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'created':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'updated':
        default:
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Event handlers
  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    
    const templateData = selectedTemplate ? {
      template_id: selectedTemplate.id,
      template_name: selectedTemplate.name
    } : {};
    
    createWorkspace.mutate({ 
      name: newWorkspaceName.trim(),
      ...templateData
    });
  };

  const handleWorkspaceAction = (action: string, workspaceId: string) => {
    switch (action) {
      case 'open':
        router.push(`/workspace?workspace=${workspaceId}`);
        break;
      case 'duplicate':
        // Implement duplicate functionality
        console.log('Duplicate workspace:', workspaceId);
        break;
      case 'rename':
        // Implement rename functionality
        console.log('Rename workspace:', workspaceId);
        break;
      case 'archive':
        // Implement archive functionality
        console.log('Archive workspace:', workspaceId);
        break;
      case 'delete':
        // Implement delete functionality
        console.log('Delete workspace:', workspaceId);
        break;
    }
    setShowWorkspaceMenu(false);
    setSelectedWorkspace(null);
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
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold">GraphBatch</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href="/dashboard" 
                className="flex items-center gap-2 text-[var(--text-primary)] font-medium"
              >
                <FolderOpen className="w-4 h-4" />
                Workspaces
              </Link>
              <Link 
                href="/dashboard/analytics" 
                className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Activity className="w-4 h-4" />
                Analytics
              </Link>
              <Link 
                href="/dashboard/settings" 
                className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <AuthStatus />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Welcome back
          </h1>
          <p className="text-[var(--text-secondary)]">
            Manage your animation workspaces and create stunning video content.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Total Workspaces</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {workspaces?.length ?? 0}
                </p>
              </div>
              <FolderOpen className="w-8 h-8 text-[var(--accent-primary)]" />
            </div>
          </div>

          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Videos Created</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {workspaceStats?.totalVideos ?? 0}
                </p>
              </div>
              <Video className="w-8 h-8 text-[var(--node-geometry)]" />
            </div>
          </div>

          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">This Month</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {workspaceStats?.thisMonth ?? 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-[var(--success-500)]" />
            </div>
          </div>

          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Active Projects</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {workspaceStats?.activeProjects ?? 0}
                </p>
              </div>
              <Activity className="w-8 h-8 text-[var(--warning-500)]" />
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-8">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
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
            
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Workspace
            </Button>
          </div>
        </div>

        {/* Create Workspace Form */}
        {showCreateForm && (
          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-6 backdrop-blur-sm mb-8">
            <div className="flex items-center justify-between mb-4">
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
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                Choose a template (optional)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {workspaceTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`p-4 border rounded-lg text-left transition-all ${
                      selectedTemplate?.id === template.id
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'border-[var(--border-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--surface-2)]'
                    }`}
                    onClick={() => selectTemplate(template)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-[var(--accent-primary)]">{template.icon}</div>
                      <div className="font-medium text-[var(--text-primary)]">{template.name}</div>
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">{template.description}</div>
                  </button>
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
                  <Loader2 className="w-4 h-4 animate-spin" />
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
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                selectedCategory === category.id
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)]'
              }`}
            >
              {category.icon}
              {category.name} ({category.count})
            </button>
          ))}
        </div>

        {/* View Controls and Sorting */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-[var(--surface-2)] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-[var(--surface-interactive)] text-[var(--text-primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-[var(--surface-interactive)] text-[var(--text-primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)]">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'updated' | 'created')}
                className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)]"
              >
                <option value="updated">Last Updated</option>
                <option value="created">Date Created</option>
                <option value="name">Name</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 hover:bg-[var(--surface-interactive)] rounded transition-colors"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="text-sm text-[var(--text-tertiary)]">
            {filteredWorkspaces.length} workspace{filteredWorkspaces.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Content */}
        {isError ? (
          <div className="text-center py-12">
            <div className="bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 rounded-lg p-6 inline-block">
              <AlertCircle className="w-12 h-12 text-[var(--danger-500)] mx-auto mb-4" />
              <p className="text-[var(--danger-500)] font-medium mb-4">
                Failed to load workspaces
              </p>
              <Button onClick={() => refetch()} variant="secondary">
                Try Again
              </Button>
            </div>
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="text-center py-12">
            {searchQuery || selectedCategory !== 'all' ? (
              <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-lg p-8 inline-block">
                <Search className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  No workspaces found
                </h3>
                <p className="text-[var(--text-secondary)] mb-4">
                  Try adjusting your search terms or filters.
                </p>
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory('all');
                  }}
                  variant="secondary"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-lg p-8 inline-block">
                <FolderOpen className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  No workspaces yet
                </h3>
                <p className="text-[var(--text-secondary)] mb-4">
                  Create your first workspace to start building animations.
                </p>
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workspace
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Recent Workspaces */}
            {!searchQuery && selectedCategory === 'all' && recentWorkspaces.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                  Recent Workspaces
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {recentWorkspaces.map((workspace) => (
                    <div
                      key={workspace.id}
                      className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-6 backdrop-blur-sm hover:border-[var(--accent-primary)] transition-all cursor-pointer group"
                      onClick={() => router.push(`/workspace?workspace=${workspace.id}`)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] rounded-lg flex items-center justify-center">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                        <button 
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[var(--surface-2)] rounded"
                          onClick={(e) => openWorkspaceMenu(e, workspace.id)}
                        >
                          <MoreVertical className="w-4 h-4 text-[var(--text-tertiary)]" />
                        </button>
                      </div>
                      
                      <h3 className="font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent-primary)] transition-colors">
                        {workspace.name}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(workspace.updated_at)}
                        </div>
                        {workspace.video_count && (
                          <div className="flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            {workspace.video_count} video{workspace.video_count !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Workspaces */}
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                {searchQuery ? `Search Results (${filteredWorkspaces.length})` : 
                 selectedCategory !== 'all' ? `${categories.find(c => c.id === selectedCategory)?.name} (${filteredWorkspaces.length})` : 
                 "All Workspaces"}
              </h2>
              
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredWorkspaces.map((workspace) => (
                    <div
                      key={workspace.id}
                      className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-6 backdrop-blur-sm hover:border-[var(--accent-primary)] transition-all cursor-pointer group"
                      onClick={() => router.push(`/workspace?workspace=${workspace.id}`)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] rounded-lg flex items-center justify-center">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                        <button 
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[var(--surface-2)] rounded"
                          onClick={(e) => openWorkspaceMenu(e, workspace.id)}
                        >
                          <MoreVertical className="w-4 h-4 text-[var(--text-tertiary)]" />
                        </button>
                      </div>
                      
                      <h3 className="font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent-primary)] transition-colors">
                        {workspace.name}
                      </h3>
                      
                      <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last updated {formatDate(workspace.updated_at)}
                        </div>
                        {workspace.video_count && (
                          <div className="flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            {workspace.video_count} video{workspace.video_count !== 1 ? 's' : ''}
                          </div>
                        )}
                        {workspace.size && (
                          <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {formatFileSize(workspace.size)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-lg overflow-hidden">
                  {filteredWorkspaces.map((workspace, index) => (
                    <div
                      key={workspace.id}
                      className={`flex items-center justify-between p-4 hover:bg-[var(--surface-interactive)] transition-colors cursor-pointer group ${
                        index !== filteredWorkspaces.length - 1 ? "border-b border-[var(--border-primary)]" : ""
                      }`}
                      onClick={() => router.push(`/workspace?workspace=${workspace.id}`)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)] rounded-lg flex items-center justify-center flex-shrink-0">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                            {workspace.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] mt-1">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last updated {formatDate(workspace.updated_at)}
                            </div>
                            {workspace.video_count && (
                              <div className="flex items-center gap-1">
                                <Video className="w-3 h-3" />
                                {workspace.video_count} video{workspace.video_count !== 1 ? 's' : ''}
                              </div>
                            )}
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
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Open
                        </Button>
                        
                        <button
                          className="p-2 hover:bg-[var(--surface-2)] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          onClick={(e) => openWorkspaceMenu(e, workspace.id)}
                        >
                          <MoreVertical className="w-4 h-4 text-[var(--text-tertiary)]" />
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

      {/* Workspace Actions Menu */}
      {showWorkspaceMenu && selectedWorkspace && (
        <div 
          className="fixed z-50 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-lg shadow-lg backdrop-blur-sm workspace-menu"
          style={{
            left: menuPosition.x,
            top: menuPosition.y,
            transform: 'translate(-50%, 10px)'
          }}
        >
          <div className="py-2">
            <button
              onClick={() => handleWorkspaceAction('open', selectedWorkspace)}
              className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Open
            </button>
            <button
              onClick={() => handleWorkspaceAction('duplicate', selectedWorkspace)}
              className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>
            <button
              onClick={() => handleWorkspaceAction('rename', selectedWorkspace)}
              className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Rename
            </button>
            <button
              onClick={() => handleWorkspaceAction('share', selectedWorkspace)}
              className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={() => handleWorkspaceAction('download', selectedWorkspace)}
              className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <div className="border-t border-[var(--border-primary)] my-1"></div>
            <button
              onClick={() => handleWorkspaceAction('archive', selectedWorkspace)}
              className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
            <button
              onClick={() => handleWorkspaceAction('delete', selectedWorkspace)}
              className="w-full px-4 py-2 text-left text-sm text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}


    </div>
  );
}
