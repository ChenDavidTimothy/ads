"use client";
import { createBrowserClient as createBrowserClientBase } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let singleton: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  singleton ??= createBrowserClientBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return singleton;
}
