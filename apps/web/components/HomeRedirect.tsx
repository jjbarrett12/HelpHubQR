"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Client-side only: redirect to /app if logged in, so the home page never blocks on server Supabase. */
export function HomeRedirect() {
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
