"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Redirect to /app if already logged in (client-side, so login page never blocks). */
export function LoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) router.replace("/app");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
