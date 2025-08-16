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
  
  const isAuthPage = authPages.includes(url.pathname)
  const isPublicPage = publicPages.includes(url.pathname)
  const isProtectedRoute = protectedRoutes.some(route => url.pathname.startsWith(route))
  const isResetPasswordPage = url.pathname === '/reset-password'

  try {
    // Get user session
    const { data: { user }, error } = await supabase.auth.getUser()
    
    // Handle reset password page specially (needs tokens from URL)
    if (isResetPasswordPage) {
      // Allow access to reset password page regardless of auth state
      // The page itself will handle token validation
      return response
    }
    
    // Handle authentication error
    if (error) {
      console.error('Auth middleware error:', error)
      // If there's an auth error and user is on protected route, redirect to login
      if (isProtectedRoute) {
        url.pathname = '/login'
        if (request.nextUrl.pathname !== '/login') {
          url.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search)
        }
        return NextResponse.redirect(url)
      }
      return response
    }
    
    // User is authenticated
    if (user) {
      // Redirect authenticated users away from auth pages
      if (isAuthPage) {
        const redirectTo = url.searchParams.get('redirectTo')
        if (redirectTo && redirectTo.startsWith('/')) {
          // Redirect to the originally requested page
          return NextResponse.redirect(new URL(redirectTo, request.url))
        }
        // Default redirect for authenticated users
        url.pathname = '/dashboard'
        url.search = '' // Clear any query params
        return NextResponse.redirect(url)
      }
      
      // Allow access to protected routes
      return response
    }
    
    // User is not authenticated
    if (isProtectedRoute) {
      // Redirect to login with return URL
      url.pathname = '/login'
      if (request.nextUrl.pathname !== '/login') {
        url.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search)
      }
      return NextResponse.redirect(url)
    }
    
    // Allow access to public pages
    return response
    
  } catch (error) {
    console.error('Middleware error:', error)
    // On error, allow the request to continue but log it
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
