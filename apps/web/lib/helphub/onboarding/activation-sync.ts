import type { ServiceSupabase } from "./types";
import { ensureActivationStepRows } from "./onboarding-state";

async function markStepCompletedIf(
  admin: ServiceSupabase,
  organizationId: string,
  stepKey: string,
  condition: boolean
) {
  if (!condition) return;
  await admin
    .from("organization_onboarding_steps")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("step_key", stepKey)
    .in("status", ["pending", "in_progress"]);
}

/**
 * Reconciles activation steps from operational tables (idempotent upgrades to completed).
 * Does not overwrite step metadata set during provisioning.
 */
export async function syncDerivedActivationSteps(admin: ServiceSupabase, organizationId: string) {
  await ensureActivationStepRows(admin, organizationId);

  const [{ count: locCount }, { count: roleCount }, { count: mgrCount }, { count: empCount }, { count: qrCount }, { count: shiftCount }, { count: runDoneCount }, { count: chkCount }] =
    await Promise.all([
      admin.from("locations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      admin.from("staff_roles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      admin
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("role", ["manager", "admin"])
        .eq("is_active", true),
      admin.from("employees").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      admin.from("qr_destinations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      admin.from("employee_shifts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      admin
        .from("shift_checklist_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .not("completed_at", "is", null),
      admin.from("checklists").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    ]);

  const n = (c: number | null | undefined) => c ?? 0;

  await markStepCompletedIf(admin, organizationId, "organization_created", true);
  await markStepCompletedIf(admin, organizationId, "location_created", n(locCount) > 0);
  await markStepCompletedIf(admin, organizationId, "roles_seeded", n(roleCount) > 0);
  await markStepCompletedIf(admin, organizationId, "starter_templates_loaded", n(chkCount) > 0);
  await markStepCompletedIf(admin, organizationId, "managers_invited", n(mgrCount) > 0);
  await markStepCompletedIf(admin, organizationId, "employees_invited", n(empCount) > 0);
  await markStepCompletedIf(admin, organizationId, "qr_destinations_created", n(qrCount) > 0);
  await markStepCompletedIf(admin, organizationId, "first_shift_created", n(shiftCount) > 0);
  await markStepCompletedIf(admin, organizationId, "first_checklist_run_completed", n(runDoneCount) > 0);
}
