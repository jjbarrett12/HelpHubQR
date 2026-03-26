import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const HH_ACTIVE_ORG_COOKIE = "hh_active_org";

export async function listUserOrganizationIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => r.organization_id as string);
  return [...new Set(ids)];
}

export async function resolveActiveOrganizationId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const ids = await listUserOrganizationIds(supabase, userId);
  if (ids.length === 0) return null;
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(HH_ACTIVE_ORG_COOKIE)?.value;
  if (fromCookie && ids.includes(fromCookie)) return fromCookie;
  return ids[0] ?? null;
}

/**
 * Route handlers: optional `organizationId` from JSON body (native clients with Bearer, no org cookie).
 * When set, must be a membership of `userId`. Otherwise falls back to cookie + first membership.
 */
export async function resolveOrganizationIdForHelpHubApi(
  supabase: SupabaseClient,
  userId: string,
  preferredOrganizationId: string | undefined | null
): Promise<{ organizationId: string } | { error: "NO_ORGANIZATION" | "NOT_ORG_MEMBER" }> {
  const ids = await listUserOrganizationIds(supabase, userId);
  if (ids.length === 0) return { error: "NO_ORGANIZATION" };
  const trimmed = preferredOrganizationId?.trim();
  if (trimmed) {
    if (!ids.includes(trimmed)) return { error: "NOT_ORG_MEMBER" };
    return { organizationId: trimmed };
  }
  const resolved = await resolveActiveOrganizationId(supabase, userId);
  if (!resolved) return { error: "NO_ORGANIZATION" };
  return { organizationId: resolved };
}

export async function setActiveOrganizationIdCookie(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(HH_ACTIVE_ORG_COOKIE, organizationId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
  });
}
