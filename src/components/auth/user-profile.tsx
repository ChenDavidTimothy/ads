'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import { RobustImage } from '@/components/ui/robust-image';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

interface UserProfileData {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
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

interface UserProfileProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function UserProfile({ className, size = 'md', showTooltip = true }: UserProfileProps) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [userData, setUserData] = useState<UserProfileData | null>(null);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const extractUserInfo = useCallback(
    (user: {
      email?: string;
      user_metadata?: {
        full_name?: string;
        name?: string;
        first_name?: string;
        last_name?: string;
        avatar_url?: string;
        picture?: string;
      };
    }): UserProfileData => {
      const email = user.email ?? null;
      let displayName: string | null = null;
      let avatarUrl: string | null = null;

      // Extract display name
      if (user.user_metadata?.full_name) {
        displayName = user.user_metadata.full_name;
      } else if (user.user_metadata?.name) {
        displayName = user.user_metadata.name;
      } else if (user.user_metadata?.first_name && user.user_metadata?.last_name) {
        displayName = `${user.user_metadata.first_name} ${user.user_metadata.last_name}`;
      } else if (user.user_metadata?.first_name) {
        displayName = user.user_metadata.first_name;
      }

      // Extract avatar URL (Google OAuth provides this)
      if (user.user_metadata?.avatar_url) {
        avatarUrl = user.user_metadata.avatar_url;
      } else if (user.user_metadata?.picture) {
        avatarUrl = user.user_metadata.picture;
      }

      return { email, displayName, avatarUrl };
    },
    []
  );

  const loadUserProfile = useCallback(async () => {
    const supabase = createBrowserClient();

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[USER_PROFILE] Session check error:', error);
        setAuthState('unauthenticated');
        return;
      }

      if (data.session?.user) {
        const userInfo = extractUserInfo(data.session.user);
        setUserData(userInfo);
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    } catch (error) {
      console.error('[USER_PROFILE] Auth check failed:', error);
      setAuthState('unauthenticated');
    }
  }, [extractUserInfo]);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile]);

  const handleProfileClick = () => {
    const targetUrl = authState === 'authenticated' ? '/dashboard/settings' : '/login';

    // Check if there's a guarded router available (when workspace has unsaved changes)
    const guardedRouter = window.__guardedRouter;
    if (guardedRouter) {
      guardedRouter.push(targetUrl);
    } else {
      router.push(targetUrl);
    }
  };

  // Show loading state
  if (authState === 'loading') {
    return (
      <button
        onClick={handleProfileClick}
        className={cn(
          'flex cursor-pointer items-center justify-center rounded-full bg-[var(--surface-2)] ring-2 ring-[var(--border-primary)] transition-all hover:ring-[var(--accent-primary)]',
          sizeClasses[size],
          className
        )}
        aria-label="Loading user profile"
      >
        <div className="h-4 w-4 animate-pulse rounded-full bg-[var(--text-tertiary)]" />
      </button>
    );
  }

  // Show unauthenticated state
  if (authState === 'unauthenticated') {
    return (
      <button
        onClick={handleProfileClick}
        className={cn(
          'flex cursor-pointer items-center justify-center rounded-full bg-[var(--surface-2)] ring-2 ring-[var(--border-primary)] transition-all hover:ring-[var(--accent-primary)]',
          sizeClasses[size],
          className
        )}
        aria-label="Sign in"
        title={showTooltip ? 'Sign in' : undefined}
      >
        <svg
          className="h-4 w-4 text-[var(--text-tertiary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </button>
    );
  }

  // Show authenticated state with profile picture
  const displayName = userData?.displayName ?? userData?.email ?? 'User';
  const initials = displayName
    .split(' ')
    .map((name) => name.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <button
      onClick={handleProfileClick}
      className={cn(
        'relative cursor-pointer overflow-hidden rounded-full ring-2 ring-[var(--border-primary)] transition-all hover:ring-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--surface-1)] focus:outline-none',
        sizeClasses[size],
        className
      )}
      aria-label={`Go to settings - Signed in as ${displayName}`}
      title={showTooltip ? `Go to settings - Signed in as ${displayName}` : undefined}
    >
      {userData?.avatarUrl ? (
        <RobustImage
          src={userData.avatarUrl}
          alt={`${displayName}'s profile picture`}
          variant="avatar"
          initials={initials}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[var(--accent-primary)] text-xs font-medium text-[var(--text-on-accent)]">
          {initials}
        </div>
      )}
    </button>
  );
}
