"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safePostLoginPath } from "@/lib/nav/safe-post-login-path";

/** Redirect to /app if already logged in (client-side, so login page never blocks). */
export function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safePostLoginPath(searchParams.get("next"));

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) router.replace(next);
    });
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  return null;
}
