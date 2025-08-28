"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/utils/supabase/client";
import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthStatus } from "@/components/auth/auth-status";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Lock,
  Bell,
  Shield,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Logo from "@/components/ui/logo";

interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  created_at: string;
}

interface UserMetadata {
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

interface AuthUser {
  id: string;
  email: string;
  user_metadata?: UserMetadata;
  created_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const { toast } = useNotifications();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<
    "profile" | "password" | "notifications" | "danger"
  >("profile");

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          router.push("/login");
          return;
        }

        const profile: UserProfile = {
          id: authUser.id,
          email: authUser.email!,
          first_name: (authUser as AuthUser).user_metadata?.first_name,
          last_name: (authUser as AuthUser).user_metadata?.last_name,
          full_name: (authUser as AuthUser).user_metadata?.full_name,
          created_at: authUser.created_at,
        };

        setUser(profile);
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
      } catch {
        setError("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    void loadUserProfile();
  }, [router, supabase.auth]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        },
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess("Profile updated successfully");

      // Update local state
      if (user) {
        setUser({
          ...user,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError("Current password is required");
      return;
    }

    if (!newPassword) {
      setError("New password is required");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setSaving(true);

    try {
      // First verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email,
        password: currentPassword,
      });

      if (signInError) {
        setError("Current password is incorrect");
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update password",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (
      !confirm(
        "Are you sure you want to sign out?",
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      await supabase.auth.signOut();
      toast.success("Signed out successfully", "Come back soon!");
      router.push("/login");
    } catch (error) {
      console.error("[SETTINGS] Logout error:", error);
      toast.error("Logout failed", "Please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        "Are you sure you want to delete your account? This action cannot be undone.",
      )
    ) {
      return;
    }

    if (
      !confirm(
        "This will permanently delete all your workspaces and data. Type 'DELETE' to confirm.",
      )
    ) {
      return;
    }

    // Note: Account deletion would need to be implemented on the backend
    // This is just a placeholder for the UI
    alert(
      "Account deletion is not yet implemented. Please contact support to delete your account.",
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-0)]">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "password", label: "Password", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "danger", label: "Danger Zone", icon: Shield },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Back */}
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="flex items-center gap-3">
                <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
                <div className="flex items-center gap-3">
                  <Logo className="h-8 w-32" />
                </div>
              </Link>

              <div className="text-[var(--text-tertiary)]">/</div>

              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                Settings
              </h1>
            </div>

            {/* User Menu */}
            <AuthStatus />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "primary" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start rounded-none border-b-2",
                      activeTab === tab.id
                        ? "border-[var(--accent-primary)]"
                        : "border-transparent",
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 backdrop-blur-sm">
              {/* Status Messages */}
              {error && (
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-[var(--danger-500)]/20 bg-[var(--danger-500)]/10 p-3">
                  <AlertTriangle className="h-4 w-4 text-[var(--danger-500)]" />
                  <p className="text-sm font-medium text-[var(--danger-500)]">
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-[var(--success-500)]/20 bg-[var(--success-500)]/10 p-3">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" />
                  <p className="text-sm font-medium text-[var(--success-500)]">
                    {success}
                  </p>
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div>
                  <h2 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">
                    Profile Information
                  </h2>

                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="firstName"
                          className="block text-sm font-medium text-[var(--text-primary)]"
                        >
                          First name
                        </label>
                        <Input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Enter your first name"
                        />
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="lastName"
                          className="block text-sm font-medium text-[var(--text-primary)]"
                        >
                          Last name
                        </label>
                        <Input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Enter your last name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[var(--text-primary)]">
                        Email address
                      </label>
                      <Input
                        type="email"
                        value={user?.email ?? ""}
                        disabled
                        className="cursor-not-allowed bg-[var(--surface-2)]"
                      />
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Email address cannot be changed. Contact support if you
                        need to update your email.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[var(--text-primary)]">
                        Member since
                      </label>
                      <Input
                        type="text"
                        value={
                          user
                            ? new Date(user.created_at).toLocaleDateString()
                            : ""
                        }
                        disabled
                        className="cursor-not-allowed bg-[var(--surface-2)]"
                      />
                    </div>

                    <Button type="submit" disabled={saving} variant="primary">
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </form>

                  {/* Logout Section */}
                  <div className="mt-8 border-t border-[var(--border-primary)] pt-6">
                    <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                      Account Actions
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--text-primary)]">
                          Sign Out
                        </h4>
                        <p className="text-sm text-[var(--text-secondary)]">
                          Sign out of your account and return to the login page
                        </p>
                      </div>
                      <Button
                        onClick={handleLogout}
                        disabled={saving}
                        variant="secondary"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing out...
                          </>
                        ) : (
                          <>
                            Sign Out
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Password Tab */}
              {activeTab === "password" && (
                <div>
                  <h2 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">
                    Change Password
                  </h2>

                  <form onSubmit={handleUpdatePassword} className="space-y-6">
                    <div className="space-y-2">
                      <label
                        htmlFor="currentPassword"
                        className="block text-sm font-medium text-[var(--text-primary)]"
                      >
                        Current password
                      </label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter your current password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4 text-[var(--text-tertiary)]" />
                          ) : (
                            <Eye className="h-4 w-4 text-[var(--text-tertiary)]" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="newPassword"
                        className="block text-sm font-medium text-[var(--text-primary)]"
                      >
                        New password
                      </label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter your new password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4 text-[var(--text-tertiary)]" />
                          ) : (
                            <Eye className="h-4 w-4 text-[var(--text-tertiary)]" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-[var(--text-primary)]"
                      >
                        Confirm new password
                      </label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your new password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-[var(--text-tertiary)]" />
                          ) : (
                            <Eye className="h-4 w-4 text-[var(--text-tertiary)]" />
                          )}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" disabled={saving} variant="primary">
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Update Password
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <div>
                  <h2 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">
                    Notification Preferences
                  </h2>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">
                          Email Notifications
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                          Receive emails about your account activity and updates
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={emailNotifications}
                          onChange={(e) =>
                            setEmailNotifications(e.target.checked)
                          }
                        />
                        <div className="peer h-6 w-11 rounded-full bg-[var(--surface-2)] peer-checked:bg-[var(--accent-primary)] peer-focus:ring-4 peer-focus:ring-[var(--accent-primary)]/20 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">
                          Marketing Emails
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                          Receive emails about new features and product updates
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={marketingEmails}
                          onChange={(e) => setMarketingEmails(e.target.checked)}
                        />
                        <div className="peer h-6 w-11 rounded-full bg-[var(--surface-2)] peer-checked:bg-[var(--accent-primary)] peer-focus:ring-4 peer-focus:ring-[var(--accent-primary)]/20 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                      </label>
                    </div>

                    <Button variant="primary">
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </Button>
                  </div>
                </div>
              )}

              {/* Danger Zone Tab */}
              {activeTab === "danger" && (
                <div>
                  <h2 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">
                    Danger Zone
                  </h2>

                  <div className="rounded-lg border border-[var(--danger-500)]/20 bg-[var(--danger-500)]/5 p-6">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="mt-1 h-6 w-6 flex-shrink-0 text-[var(--danger-500)]" />
                      <div className="flex-1">
                        <h3 className="mb-2 text-lg font-medium text-[var(--text-primary)]">
                          Delete Account
                        </h3>
                        <p className="mb-4 text-[var(--text-secondary)]">
                          Once you delete your account, there is no going back.
                          Please be certain. This will permanently delete:
                        </p>
                        <ul className="mb-6 space-y-1 text-sm text-[var(--text-secondary)]">
                          <li>• All of your workspaces and projects</li>
                          <li>• All generated videos and animations</li>
                          <li>• Your account information and settings</li>
                          <li>• All associated data and files</li>
                        </ul>
                        <Button variant="danger" onClick={handleDeleteAccount}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Account
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
