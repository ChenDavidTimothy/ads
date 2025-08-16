import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const url = request.nextUrl.clone()
  
  // Define route types
  const authPages = ['/login', '/register', '/forgot-password']
  const publicPages = [...authPages, '/reset-password', '/', '/terms', '/privacy', '/contact']
  const protectedRoutes = ['/workspace', '/dashboard']
  const apiProtectedRoutes = ['/api/trpc'] // Add API route protection
  
  const isAuthPage = authPages.includes(url.pathname)
  const isPublicPage = publicPages.includes(url.pathname)
  const isProtectedRoute = protectedRoutes.some(route => url.pathname.startsWith(route))
  const isApiProtectedRoute = apiProtectedRoutes.some(route => url.pathname.startsWith(route))
  const isResetPasswordPage = url.pathname === '/reset-password'

  try {
    // Get user session with improved error handling
    const { data: { user }, error } = await supabase.auth.getUser()
    
    // Handle reset password page specially (needs tokens from URL)
    if (isResetPasswordPage) {
      // Allow access to reset password page regardless of auth state
      // The page itself will handle token validation
      return addSecurityHeaders(response, request)
    }
    
    // Handle authentication error
    if (error) {
      // Log auth errors with more context for debugging
      console.error('Auth middleware error:', {
        error: error.message,
        path: request.nextUrl.pathname,
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      })
      
      // If there's an auth error and user is on protected route, redirect to login
      if (isProtectedRoute || isApiProtectedRoute) {
        // For API routes, return 401 instead of redirect
        if (isApiProtectedRoute) {
          return new NextResponse('Unauthorized', { status: 401 })
        }
        
        url.pathname = '/login'
        if (request.nextUrl.pathname !== '/login') {
          url.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search)
        }
        return NextResponse.redirect(url)
      }
      return addSecurityHeaders(response, request)
    }
    
    // User is authenticated
    if (user) {
      // Redirect authenticated users away from auth pages
      if (isAuthPage) {
        const redirectTo = url.searchParams.get('redirectTo')
        if (redirectTo && redirectTo.startsWith('/')) {
          // Validate redirect URL to prevent open redirects
          try {
            const redirectUrl = new URL(redirectTo, request.url)
            if (redirectUrl.origin === request.nextUrl.origin) {
              return NextResponse.redirect(redirectUrl)
            }
          } catch {
            // Invalid redirect URL, fall back to dashboard
          }
        }
        // Default redirect for authenticated users
        url.pathname = '/dashboard'
        url.search = '' // Clear any query params
        return NextResponse.redirect(url)
      }
      
      // Allow access to protected routes and APIs
      return addSecurityHeaders(response, request)
    }
    
    // User is not authenticated
    if (isProtectedRoute || isApiProtectedRoute) {
      // For API routes, return 401 instead of redirect
      if (isApiProtectedRoute) {
        return new NextResponse('Unauthorized', { status: 401 })
      }
      
      // Redirect to login with return URL
      url.pathname = '/login'
      if (request.nextUrl.pathname !== '/login') {
        url.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search)
      }
      return NextResponse.redirect(url)
    }
    
    // Allow access to public pages
    return addSecurityHeaders(response, request)
    
  } catch (error) {
    // Enhanced error logging for production debugging
    console.error('Middleware critical error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: request.nextUrl.pathname,
      method: request.method,
      timestamp: new Date().toISOString()
    })
    
    // On critical error, allow the request to continue but add security headers
    return addSecurityHeaders(response, request)
  }
}

// Add comprehensive security headers
function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Disable potentially dangerous browser features
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  
  // Prevent XSS in older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Production security enhancements
  if (process.env.NODE_ENV === 'production') {
    // Strict CSP for production
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
      ].join('; ')
    )
    
    // Force HTTPS in production
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }
  
  // Rate limiting indicators (can be used by reverse proxy)
  response.headers.set('X-Request-ID', crypto.randomUUID())
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - API webhook endpoints that need custom auth
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}