import { getStarterPack } from "@/lib/onboarding/starter-packs";
import { upsertStepStatus } from "./onboarding-state";
import { hasSucceededProvisioning, runWithIdempotency } from "./idempotency";
import type { ServiceSupabase } from "./types";

function taxonomyKey(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

/** Maps API "other" / unknown to pack resolver (getStarterPack already falls back to general). */
export function industryForStarterPack(industry: string | null | undefined): string | null {
  if (!industry || industry === "other") return null;
  return industry;
}

export async function seedDefaultRolesForOrg(
  admin: ServiceSupabase,
  organizationId: string,
  industry: string | null | undefined
): Promise<{ ok: true; skipped: boolean } | { ok: false; error: string }> {
  const pack = getStarterPack(industry ?? undefined);
  const key = `seed_roles:${pack.industry}:v${pack.version}`;
  const res = await runWithIdempotency(admin, organizationId, "seed_default_roles", key, async () => {
    for (const name of pack.defaultRoles) {
      const { data: dup } = await admin
        .from("staff_roles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("name", name)
        .maybeSingle();
      if (dup) continue;
      const { error } = await admin.from("staff_roles").insert({ organization_id: organizationId, name });
      if (error) throw new Error(error.message);
    }
    await upsertStepStatus(admin, organizationId, "roles_seeded", "completed");
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, skipped: res.skipped };
}

export async function ensureDefaultWorkforceSettingsForOrg(
  admin: ServiceSupabase,
  organizationId: string
): Promise<{ ok: true; skipped: boolean } | { ok: false; error: string }> {
  const res = await runWithIdempotency(
    admin,
    organizationId,
    "ensure_workforce_settings",
    "workforce_defaults:v1",
    async () => {
      const { data: existing } = await admin
        .from("organization_workforce_settings")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (existing) return;
      const { error } = await admin.from("organization_workforce_settings").insert({
        organization_id: organizationId,
      });
      if (error) throw new Error(error.message);
    }
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, skipped: res.skipped };
}

export type ApplyStarterPackOptions = {
  idempotencyKeyOverride?: string;
};

export async function applyStarterPackForOrg(
  admin: ServiceSupabase,
  organizationId: string,
  industry: string | null | undefined,
  options?: ApplyStarterPackOptions
): Promise<{ ok: true; skipped: boolean } | { ok: false; error: string }> {
  const pack = getStarterPack(industry ?? undefined);
  const key =
    options?.idempotencyKeyOverride ?? `starter_pack:${pack.industry}:v${pack.version}`;
  const res = await runWithIdempotency(admin, organizationId, "apply_starter_pack", key, async () => {
    const rolesResult = await seedDefaultRolesForOrg(admin, organizationId, pack.industry);
    if (!rolesResult.ok) throw new Error(rolesResult.error);

    const { data: roles } = await admin
      .from("staff_roles")
      .select("id, name")
      .eq("organization_id", organizationId);
    const roleByName = new Map((roles ?? []).map((r) => [r.name as string, r.id as string]));

    for (const tpl of pack.checklistTemplates) {
      const roleId = roleByName.get(tpl.roleName);
      if (!roleId) continue;
      const chkKey = `starter_checklist:${pack.industry}:v${pack.version}:${tpl.templateId}`;
      if (await hasSucceededProvisioning(admin, organizationId, chkKey)) continue;

      const { data: existingChk } = await admin
        .from("checklists")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("name", tpl.name)
        .maybeSingle();
      if (existingChk?.id) continue;

      const { data: checklist, error: cErr } = await admin
        .from("checklists")
        .insert({
          organization_id: organizationId,
          location_id: null,
          staff_role_id: roleId,
          shift_type: tpl.shift_type,
          name: tpl.name,
          description: tpl.description ?? null,
          is_active: true,
        })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);

      const items = tpl.items.map((it) => ({
        checklist_id: checklist.id,
        task_text: it.task_text,
        sort_order: it.sort_order,
        requires_photo: it.requires_photo,
      }));
      const { error: iErr } = await admin.from("checklist_items").insert(items);
      if (iErr) throw new Error(iErr.message);

      await admin.from("organization_provisioning_events").insert({
        organization_id: organizationId,
        event_type: "starter_checklist_template",
        status: "succeeded",
        idempotency_key: chkKey,
        payload: { templateId: tpl.templateId, checklist_id: checklist.id },
      });
    }

    for (const label of pack.issueCategoryLabels) {
      const task_key = taxonomyKey(label) || "category";
      await admin.from("task_taxonomy").upsert(
        {
          organization_id: organizationId,
          task_key,
          display_label: label,
          description: "Starter pack category",
          is_active: true,
        },
        { onConflict: "organization_id,task_key" }
      );
    }

    await upsertStepStatus(admin, organizationId, "starter_templates_loaded", "completed", {
      qrSuggestions: pack.qrSuggestions,
      packVersion: pack.version,
      industry: pack.industry,
    });
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, skipped: res.skipped };
}

export async function createFirstLocationIfNeeded(
  admin: ServiceSupabase,
  organizationId: string,
  name: string,
  address?: string | null
): Promise<
  { ok: true; skipped: boolean; locationId: string } | { ok: false; error: string }
> {
  const slug = name.trim().toLowerCase().slice(0, 80);
  const key = `location:first:${slug}`;

  async function firstLocationId(): Promise<string | null> {
    const { data: loc } = await admin
      .from("locations")
      .select("id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (loc?.id as string | undefined) ?? null;
  }

  const res = await runWithIdempotency(admin, organizationId, "create_first_location", key, async () => {
    const existingId = await firstLocationId();
    if (existingId) {
      await upsertStepStatus(admin, organizationId, "location_created", "completed");
      return { locationId: existingId };
    }
    const { data, error } = await admin
      .from("locations")
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        address: address?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await upsertStepStatus(admin, organizationId, "location_created", "completed");
    return { locationId: data.id as string };
  });

  if (!res.ok) return { ok: false, error: res.error };
  if (res.skipped) {
    const id = await firstLocationId();
    if (!id) return { ok: false, error: "Idempotent hit but no location row found for org" };
    return { ok: true, skipped: true, locationId: id };
  }
  return { ok: true, skipped: false, locationId: res.data.locationId };
}
