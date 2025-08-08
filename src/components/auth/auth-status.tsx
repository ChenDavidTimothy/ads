"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@/utils/supabase/client";

export function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    let isMounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setEmail(data.user?.email ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    setEmail(null);
  };

  if (loading) return null;

  return (
    <div className="text-sm flex items-center gap-2">
      {email ? (
        <>
          <span>Signed in as {email}</span>
          <button onClick={handleLogout} className="underline">Logout</button>
        </>
      ) : (
        <Link href="/auth" className="underline">Login</Link>
      )}
    </div>
  );
}


