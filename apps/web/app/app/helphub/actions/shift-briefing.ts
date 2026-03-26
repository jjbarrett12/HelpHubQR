"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { userCanManageOrganization } from "@/lib/helphub/require-org";
import { shiftBriefingNoteBodySchema } from "@/lib/validation/schemas";

export async function addShiftBriefingNote(
  input: unknown
): Promise<{ ok?: true; error?: string }> {
  const parsed = shiftBriefingNoteBodySchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? parsed.error.message;
    return { error: msg };
  }
  const { employeeShiftId, note, visibleToEmployee } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "Not signed in" };

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) return { error: "No organization selected" };

  const canManage = await userCanManageOrganization(supabase, user.id, orgId);
  if (!canManage) return { error: "Only organization managers can add shift notes" };

  const { data: shift, error: shiftErr } = await supabase
    .from("employee_shifts")
    .select("organization_id")
    .eq("id", employeeShiftId)
    .maybeSingle();

  if (shiftErr || !shift?.organization_id) {
    return { error: "Shift not found" };
  }
  if (shift.organization_id !== orgId) {
    return { error: "Shift is not in the active organization" };
  }

  const { error: insErr } = await supabase.from("shift_notes").insert({
    organization_id: orgId,
    employee_shift_id: employeeShiftId,
    note,
    created_by: user.id,
    visible_to_employee: visibleToEmployee,
  });

  if (insErr) return { error: insErr.message };

  revalidatePath("/app/shift-ops");
  return { ok: true };
}
