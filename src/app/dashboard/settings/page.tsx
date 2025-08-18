"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthStatus } from "@/components/auth/auth-status";
import { 
  ArrowLeft,
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertTriangle
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
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'notifications' | 'danger'>('profile');

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
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
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }

    if (!confirm("This will permanently delete all your workspaces and data. Type 'DELETE' to confirm.")) {
      return;
    }

    // Note: Account deletion would need to be implemented on the backend
    // This is just a placeholder for the UI
    alert("Account deletion is not yet implemented. Please contact support to delete your account.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'danger', label: 'Danger Zone', icon: Shield },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Back */}
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="flex items-center gap-3">
                <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
                <div className="flex items-center gap-3">
                  <Logo className="w-32 h-8" />
                </div>
              </Link>
              
              <div className="text-[var(--text-tertiary)]">/</div>
              
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h1>
            </div>

            {/* User Menu */}
            <AuthStatus />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? "bg-[var(--accent-primary)] text-white"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-8 backdrop-blur-sm">
              {/* Status Messages */}
              {error && (
                <div className="mb-6 p-3 bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--danger-500)]" />
                  <p className="text-sm text-[var(--danger-500)] font-medium">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-6 p-3 bg-[var(--success-500)]/10 border border-[var(--success-500)]/20 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success-500)]" />
                  <p className="text-sm text-[var(--success-500)] font-medium">{success}</p>
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Profile Information</h2>
                  
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="firstName" className="block text-sm font-medium text-[var(--text-primary)]">
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
                        <label htmlFor="lastName" className="block text-sm font-medium text-[var(--text-primary)]">
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
                        className="bg-[var(--surface-2)] cursor-not-allowed"
                      />
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Email address cannot be changed. Contact support if you need to update your email.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[var(--text-primary)]">
                        Member since
                      </label>
                      <Input
                        type="text"
                        value={user ? new Date(user.created_at).toLocaleDateString() : ""}
                        disabled
                        className="bg-[var(--surface-2)] cursor-not-allowed"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)]"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              )}

              {/* Password Tab */}
              {activeTab === 'password' && (
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Change Password</h2>
                  
                  <form onSubmit={handleUpdatePassword} className="space-y-6">
                    <div className="space-y-2">
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-[var(--text-primary)]">
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
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
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
                      <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--text-primary)]">
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
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
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
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-primary)]">
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
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-[var(--text-tertiary)]" />
                          ) : (
                            <Eye className="h-4 w-4 text-[var(--text-tertiary)]" />
                          )}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)]"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Update Password
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Notification Preferences</h2>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">Email Notifications</h3>
                        <p className="text-sm text-[var(--text-secondary)]">Receive emails about your account activity and updates</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-[var(--surface-2)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--accent-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">Marketing Emails</h3>
                        <p className="text-sm text-[var(--text-secondary)]">Receive emails about new features and product updates</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={marketingEmails}
                          onChange={(e) => setMarketingEmails(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-[var(--surface-2)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--accent-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                      </label>
                    </div>

                    <Button className="bg-gradient-to-r from-[var(--node-animation)] to-[var(--accent-secondary)]">
                      <Save className="w-4 h-4 mr-2" />
                      Save Preferences
                    </Button>
                  </div>
                </div>
              )}

              {/* Danger Zone Tab */}
              {activeTab === 'danger' && (
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Danger Zone</h2>
                  
                  <div className="border border-[var(--danger-500)]/20 rounded-lg p-6 bg-[var(--danger-500)]/5">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="w-6 h-6 text-[var(--danger-500)] flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">Delete Account</h3>
                        <p className="text-[var(--text-secondary)] mb-4">
                          Once you delete your account, there is no going back. Please be certain. This will permanently delete:
                        </p>
                        <ul className="text-sm text-[var(--text-secondary)] mb-6 space-y-1">
                          <li>• All of your workspaces and projects</li>
                          <li>• All generated videos and animations</li>
                          <li>• Your account information and settings</li>
                          <li>• All associated data and files</li>
                        </ul>
                        <Button 
                          variant="danger"
                          onClick={handleDeleteAccount}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
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
