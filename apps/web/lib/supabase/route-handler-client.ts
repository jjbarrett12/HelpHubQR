import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Supabase client for Route Handlers: prefers `Authorization: Bearer <access_token>` (iOS / native),
 * else cookie session (web).
 */
export async function createSupabaseForRouteHandler(req: NextRequest): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer && url && anon) {
    return createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  }
  return createServerClient();
}
