import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const url = request.nextUrl.clone();

  // Define route types
  const authPages = ['/login']; // Removed register, forgot-password
  const publicPages = [...authPages, '/auth/callback', '/', '/terms', '/privacy', '/contact'];
  const protectedRoutes: string[] = []; // Page protection handled by (protected) layout
  const apiProtectedRoutes = ['/api/trpc']; // Keep API protection here

  const isAuthPage = authPages.includes(url.pathname);
  const isPublicPage = publicPages.includes(url.pathname);
  const isProtectedRoute = protectedRoutes.some((route) => url.pathname.startsWith(route));
  const isApiProtectedRoute = apiProtectedRoutes.some((route) => url.pathname.startsWith(route));
  const isOAuthCallback = url.pathname === '/auth/callback';

  // Add security headers function
  const addSecurityHeaders = (response: NextResponse, request: NextRequest) => {
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // Add CSP for production
    if (process.env.NODE_ENV === 'production') {
      response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://accounts.google.com; frame-src https://accounts.google.com;"
      );
    }

    return response;
  };

  try {
    // Handle OAuth callback specially (needs to process auth codes)
    if (isOAuthCallback) {
      // Allow OAuth callback to proceed without session validation
      return addSecurityHeaders(response, request);
    }

    // Get user session with improved error handling
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Handle authentication error
    if (error) {
      console.error('Auth middleware error:', {
        error: error.message,
        path: request.nextUrl.pathname,
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
      });

      // If there's an auth error and user is on protected route, redirect to login
      if (isProtectedRoute || isApiProtectedRoute) {
        if (isApiProtectedRoute) {
          return new NextResponse('Unauthorized', { status: 401 });
        }

        url.pathname = '/login';
        if (request.nextUrl.pathname !== '/login') {
          url.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search);
        }
        return NextResponse.redirect(url);
      }
      return addSecurityHeaders(response, request);
    }

    // User is authenticated
    if (user) {
      // Redirect authenticated users away from auth pages
      if (isAuthPage) {
        const redirectTo = url.searchParams.get('redirectTo');
        if (redirectTo && redirectTo.startsWith('/')) {
          try {
            const redirectUrl = new URL(redirectTo, request.url);
            if (redirectUrl.origin === request.nextUrl.origin) {
              return NextResponse.redirect(redirectUrl);
            }
          } catch {
            // Invalid redirect URL, fall back to dashboard
          }
        }
        url.pathname = '/dashboard';
        url.search = '';
        return NextResponse.redirect(url);
      }

      return addSecurityHeaders(response, request);
    }

    // User is not authenticated
    if (isApiProtectedRoute) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    return addSecurityHeaders(response, request);
  } catch (error) {
    console.error('Middleware critical error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: request.nextUrl.pathname,
      timestamp: new Date().toISOString(),
    });

    // In case of critical error, allow access to public pages but block API if needed
    if (isApiProtectedRoute) {
      return new NextResponse('Service Unavailable', { status: 503 });
    }

    return addSecurityHeaders(response, request);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /api/webhook (webhooks don't need auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhook).*)',
  ],
};
