"use client";
import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserClient } from "@/utils/supabase/client";
import { useNotifications } from "@/hooks/use-notifications";

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export function AuthStatus() {
	const [email, setEmail] = useState<string | null>(null);
	const [displayName, setDisplayName] = useState<string | null>(null);
	const [authState, setAuthState] = useState<AuthState>('loading');
	const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
	const { toast } = useNotifications();
	const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const lastToastRef = useRef<string | null>(null);

	// Clear timeouts on unmount
	useEffect(() => {
		return () => {
			if (refreshTimeoutRef.current) {
				clearTimeout(refreshTimeoutRef.current);
			}
			if (sessionCheckIntervalRef.current) {
				clearInterval(sessionCheckIntervalRef.current);
			}
		};
	}, []);

	const showToastOnce = useCallback((key: string, toastFn: () => void) => {
		if (lastToastRef.current !== key) {
			lastToastRef.current = key;
			toastFn();
			setTimeout(() => {
				if (lastToastRef.current === key) {
					lastToastRef.current = null;
				}
			}, 5000);
		}
	}, []);

	const scheduleSessionRefresh = useCallback((expiresAt: Date) => {
		if (refreshTimeoutRef.current) {
			clearTimeout(refreshTimeoutRef.current);
		}

		const now = new Date();
		const timeUntilExpiry = expiresAt.getTime() - now.getTime();
		const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 60 * 1000);

		console.log(`[AUTH] Scheduling session refresh in ${Math.round(refreshTime / 1000)} seconds`);

		refreshTimeoutRef.current = setTimeout(() => {
			void (async () => {
				console.log('[AUTH] Auto-refreshing session');
				const supabase = createBrowserClient();
				
				try {
					const { data, error } = await supabase.auth.refreshSession();
					if (error) {
						console.error('[AUTH] Auto-refresh failed:', error);
						showToastOnce('refresh-failed', () => {
							toast.warning('Session refresh failed', 'Please log in again if you experience issues');
						});
						setAuthState('unauthenticated');
					} else if (data.session) {
						console.log('[AUTH] Session auto-refreshed successfully');
						setSessionExpiresAt(new Date(data.session.expires_at! * 1000));
						scheduleSessionRefresh(new Date(data.session.expires_at! * 1000));
					}
				} catch (error) {
					console.error('[AUTH] Auto-refresh error:', error);
					setAuthState('error');
				}
			})();
		}, refreshTime);
	}, [showToastOnce, toast]);

	const extractUserInfo = useCallback((user: { email?: string; user_metadata?: { full_name?: string; name?: string; first_name?: string; last_name?: string } }): { email: string | null; displayName: string | null } => {
		// Handle OAuth user data structure
		const email = user.email ?? null;
		let displayName: string | null = null;

		// Try to get display name from various OAuth provider metadata
		if (user.user_metadata?.full_name) {
			displayName = user.user_metadata.full_name;
		} else if (user.user_metadata?.name) {
			displayName = user.user_metadata.name;
		} else if (user.user_metadata?.first_name && user.user_metadata?.last_name) {
			displayName = `${user.user_metadata.first_name} ${user.user_metadata.last_name}`;
		} else if (user.user_metadata?.first_name) {
			displayName = user.user_metadata.first_name;
		}

		return { email, displayName };
	}, []);

	const checkAuthState = useCallback(async () => {
		const supabase = createBrowserClient();
		
		try {
			const { data, error } = await supabase.auth.getSession();
			
			if (error) {
				console.error('[AUTH] Session check error:', error);
				setAuthState('error');
				setEmail(null);
				setDisplayName(null);
				setSessionExpiresAt(null);
				return;
			}

			if (data.session?.user) {
				const expiresAt = new Date(data.session.expires_at! * 1000);
				const now = new Date();
				
				// Check if session is expired or about to expire (within 1 minute)
				if (expiresAt.getTime() - now.getTime() < 60 * 1000) {
					console.log('[AUTH] Session expired or about to expire, refreshing...');
					
					const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
					if (refreshError || !refreshData.session) {
						console.error('[AUTH] Session refresh failed:', refreshError);
						setAuthState('unauthenticated');
						setEmail(null);
						setDisplayName(null);
						setSessionExpiresAt(null);
						showToastOnce('session-expired', () => {
							toast.warning('Session expired', 'Please log in again');
						});
						return;
					}
					
					// Update with refreshed session
					const userInfo = extractUserInfo(refreshData.session.user);
					setEmail(userInfo.email);
					setDisplayName(userInfo.displayName);
					setAuthState('authenticated');
					const newExpiresAt = new Date((refreshData.session.expires_at ?? Date.now() / 1000 + 3600) * 1000);
					setSessionExpiresAt(newExpiresAt);
					scheduleSessionRefresh(newExpiresAt);
				} else {
					// Session is valid
					const userInfo = extractUserInfo(data.session.user);
					setEmail(userInfo.email);
					setDisplayName(userInfo.displayName);
					setAuthState('authenticated');
					setSessionExpiresAt(expiresAt);
					if (!refreshTimeoutRef.current) {
						scheduleSessionRefresh(expiresAt);
					}
				}
			} else {
				// No session
				setAuthState('unauthenticated');
				setEmail(null);
				setDisplayName(null);
				setSessionExpiresAt(null);
			}
		} catch (error) {
			console.error('[AUTH] Auth check failed:', error);
			setAuthState('error');
			setEmail(null);
			setDisplayName(null);
			setSessionExpiresAt(null);
		}
	}, [scheduleSessionRefresh, showToastOnce, toast, extractUserInfo]);

	// Initial auth check and auth state change listener
	useEffect(() => {
		const supabase = createBrowserClient();
		let isMounted = true;

		// Initial check
		void checkAuthState();

		// Handle justSignedIn cookie from OAuth callback
		if (typeof window !== 'undefined') {
			const justSignedIn = document.cookie.includes('justSignedIn=1');
			if (justSignedIn) {
				// Remove the cookie
				document.cookie = 'justSignedIn=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
				// Show welcome toast after a short delay
				setTimeout(() => {
					showToastOnce('signed-in', () => {
						toast.success('Signed in successfully', 'Welcome to Batchion!');
					});
				}, 100);
			}
		}

		// Set up auth state change listener
		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			if (!isMounted) return;
			
			console.log(`[AUTH] Auth state changed: ${event}`);
			
			switch (event) {
				case 'SIGNED_IN':
					if (session?.user) {
						const userInfo = extractUserInfo(session.user);
						setEmail(userInfo.email);
						setDisplayName(userInfo.displayName);
						setAuthState('authenticated');
						const expiresAt = new Date((session.expires_at ?? Date.now() / 1000 + 3600) * 1000);
						setSessionExpiresAt(expiresAt);
						scheduleSessionRefresh(expiresAt);
					}
					break;
					
				case 'SIGNED_OUT':
					setEmail(null);
					setDisplayName(null);
					setAuthState('unauthenticated');
					setSessionExpiresAt(null);
					if (refreshTimeoutRef.current) {
						clearTimeout(refreshTimeoutRef.current);
						refreshTimeoutRef.current = null;
					}
					if (sessionCheckIntervalRef.current) {
						clearInterval(sessionCheckIntervalRef.current);
						sessionCheckIntervalRef.current = null;
					}
					break;
					
				case 'TOKEN_REFRESHED':
					if (session?.user) {
						console.log('[AUTH] Token refreshed');
						const userInfo = extractUserInfo(session.user);
						setEmail(userInfo.email);
						setDisplayName(userInfo.displayName);
						setAuthState('authenticated');
						const expiresAt = new Date((session.expires_at ?? Date.now() / 1000 + 3600) * 1000);
						setSessionExpiresAt(expiresAt);
						scheduleSessionRefresh(expiresAt);
					}
					break;
					
				case 'USER_UPDATED':
					if (session?.user) {
						const userInfo = extractUserInfo(session.user);
						setEmail(userInfo.email);
						setDisplayName(userInfo.displayName);
					}
					break;
			}
		});

		// Periodic session health check (every 5 minutes)
		sessionCheckIntervalRef.current = setInterval(() => {
			if (isMounted) {
				void checkAuthState();
			}
		}, 5 * 60 * 1000);

		return () => {
			isMounted = false;
			subscription.unsubscribe();
			if (sessionCheckIntervalRef.current) {
				clearInterval(sessionCheckIntervalRef.current);
			}
		};
	}, [checkAuthState, scheduleSessionRefresh, showToastOnce, toast, extractUserInfo]);

	const handleLogout = useCallback(async () => {
		const supabase = createBrowserClient();
		
		try {
			setAuthState('loading');
			await supabase.auth.signOut();
			setEmail(null);
			setDisplayName(null);
			setAuthState('unauthenticated');
			setSessionExpiresAt(null);
			
			// Clean up all intervals and timeouts
			if (refreshTimeoutRef.current) {
				clearTimeout(refreshTimeoutRef.current);
				refreshTimeoutRef.current = null;
			}
			if (sessionCheckIntervalRef.current) {
				clearInterval(sessionCheckIntervalRef.current);
				sessionCheckIntervalRef.current = null;
			}
			
			toast.success('Signed out successfully', 'Come back soon!');
			
			// Redirect to login page after successful logout
			window.location.href = '/login';
		} catch (error) {
			console.error('[AUTH] Logout error:', error);
			toast.error('Logout failed', 'Please try again');
			setAuthState('error');
		}
	}, [toast]);

	const getSessionTimeRemaining = useCallback(() => {
		if (!sessionExpiresAt) return null;
		
		const now = new Date();
		const timeRemaining = sessionExpiresAt.getTime() - now.getTime();
		
		if (timeRemaining <= 0) return 'Expired';
		if (timeRemaining < 5 * 60 * 1000) return 'Expiring soon';
		if (timeRemaining < 30 * 60 * 1000) return `${Math.round(timeRemaining / (60 * 1000))}m remaining`;
		
		return null;
	}, [sessionExpiresAt]);

	const timeRemaining = getSessionTimeRemaining();

	// Show loading state
	if (authState === 'loading') {
		return (
			<div className="text-sm flex items-center gap-[var(--space-2)]">
				<div className="animate-pulse">Checking authentication...</div>
			</div>
		);
	}

	// Show error state
	if (authState === 'error') {
		return (
			<div className="text-sm flex items-center gap-[var(--space-2)] text-[var(--danger-500)]">
				<span>Auth error</span>
				<button 
					onClick={checkAuthState}
					className="underline hover:text-[var(--danger-600)]"
				>
					Retry
				</button>
			</div>
		);
	}

	// Show authenticated state
	if (authState === 'authenticated' && email) {
		const displayText = displayName ?? email;
		return (
			<div className="text-sm flex items-center gap-[var(--space-3)]">
				<div className="flex flex-col">
					<span>Signed in as {displayText}</span>
					{timeRemaining && (
						<span className={`text-xs ${timeRemaining === 'Expiring soon' ? 'text-[var(--warning-600)]' : 'text-[var(--text-tertiary)]'}`}>
							Session {timeRemaining}
						</span>
					)}
				</div>
				<button 
					onClick={handleLogout} 
					className="underline hover:text-[var(--text-secondary)]"
				>
					Logout
				</button>
			</div>
		);
	}

	// Show unauthenticated state
	return (
		<div className="text-sm flex items-center gap-[var(--space-2)]">
			<Link href="/login" className="underline hover:text-[var(--text-secondary)]">
				Login
			</Link>
		</div>
	);
}