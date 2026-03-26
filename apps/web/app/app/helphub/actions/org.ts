"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setActiveOrganizationIdCookie, resolveActiveOrganizationId } from "@/lib/helphub/org-context";

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "Not signed in" };

  const { data: orgId, error: rpcErr } = await supabase.rpc("hh_create_organization", { p_name: name });
  if (rpcErr) return { error: rpcErr.message };
  if (!orgId || typeof orgId !== "string") return { error: "Failed to create organization" };

  await setActiveOrganizationIdCookie(orgId);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/today");
  return { ok: true, organizationId: orgId };
}

export async function setActiveOrganization(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "Not signed in" };

  const { data: row } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!row) return { error: "Not a member of this organization" };

  await setActiveOrganizationIdCookie(organizationId);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function getHelpHubContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { user: null, organizationId: null, organizations: [] as { id: string; name: string }[] };

  const { data: memberships, error: memErr } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (memErr) {
    return { user, organizationId: null, organizations: [] as { id: string; name: string }[] };
  }

  const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id as string))];
  const { data: orgRows } =
    orgIds.length > 0
      ? await supabase.from("organizations").select("id, name").in("id", orgIds).order("name")
      : { data: [] as { id: string; name: string }[] };

  const organizations = (orgRows ?? []) as { id: string; name: string }[];

  const organizationId = await resolveActiveOrganizationId(supabase, user.id);
  return { user, organizationId, organizations };
}
