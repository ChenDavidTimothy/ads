import { createClient } from "@/utils/supabase/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  
  // Add these debug lines:
  console.log("🔍 Auth Callback Debug:");
  console.log("request.url:", request.url);
  console.log("origin:", origin);
  console.log("NEXT_PUBLIC_SITE_URL:", process.env.NEXT_PUBLIC_SITE_URL);
  
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors from provider
  if (error) {
    console.error("OAuth error:", error, errorDescription);
    const errorUrl = new URL("/login", origin);
    errorUrl.searchParams.set("error", error);
    if (errorDescription) {
      errorUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(errorUrl.toString());
  }

  if (!code) {
    console.error("No authorization code received");
    const errorUrl = new URL("/login", origin);
    errorUrl.searchParams.set("error", "no_code");
    return NextResponse.redirect(errorUrl.toString());
  }

  const supabase = await createClient();

  try {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Code exchange error:", exchangeError);
      const errorUrl = new URL("/login", origin);
      errorUrl.searchParams.set("error", "exchange_failed");
      return NextResponse.redirect(errorUrl.toString());
    }

    if (!data.user) {
      console.error("No user data after successful exchange");
      const errorUrl = new URL("/login", origin);
      errorUrl.searchParams.set("error", "no_user");
      return NextResponse.redirect(errorUrl.toString());
    }

    // Successful authentication
    console.log("OAuth authentication successful for user:", data.user.id);

    // Determine redirect destination
    let destination = "/dashboard";
    
    if (redirectTo?.startsWith("/")) {
      // Validate redirect URL to prevent open redirects
      try {
        const redirectUrl = new URL(redirectTo, origin);
        if (redirectUrl.origin === origin) {
          destination = redirectTo;
        }
      } catch {
        // Invalid redirect URL, use default
        console.warn("Invalid redirect URL provided:", redirectTo);
      }
    }

    // Before the final redirect, add:
    console.log("🔍 Final redirect destination:", destination);
    console.log("🔍 Final redirect origin:", origin);
    console.log("🔍 Final redirect URL:", new URL(destination, origin).toString());

    // Mark successful login for auth status component
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin;
    const response = NextResponse.redirect(new URL(destination, baseUrl));
    response.cookies.set("justSignedIn", "1", {
      maxAge: 60, // 1 minute
      httpOnly: false, // Needs to be accessible by client-side JS
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return response;

  } catch (error) {
    console.error("Unexpected error during OAuth callback:", error);
    const errorUrl = new URL("/login", origin);
    errorUrl.searchParams.set("error", "unexpected_error");
    return NextResponse.redirect(errorUrl.toString());
  }
}
