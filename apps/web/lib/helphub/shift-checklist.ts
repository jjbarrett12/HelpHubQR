import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShiftType } from "./types";
import { generateChecklistAccessToken } from "./tokens";
import { normalizeTaskKey } from "@/lib/helphub/fairness/task-key";
import { recordFairnessForAllRunItemsOnRun } from "@/lib/helphub/fairness/record";

type ShiftRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  staff_role_id: string;
  shift_type: ShiftType;
  employee_id: string;
};

/**
 * Picks the best checklist for a shift: same role + shift type, prefer location-specific over org-wide.
 */
export async function findChecklistForShift(
  supabase: SupabaseClient,
  shift: Pick<ShiftRow, "organization_id" | "location_id" | "staff_role_id" | "shift_type">
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("checklists")
    .select("id, location_id")
    .eq("organization_id", shift.organization_id)
    .eq("staff_role_id", shift.staff_role_id)
    .eq("shift_type", shift.shift_type)
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const loc = shift.location_id;
  const exact = rows.filter((r) => r.location_id === loc);
  if (exact.length > 0) return { id: exact[0].id as string };

  const generic = rows.filter((r) => r.location_id === null);
  if (generic.length > 0) return { id: generic[0].id as string };

  return null;
}

export async function createChecklistRunFromShift(
  supabase: SupabaseClient,
  shift: ShiftRow,
  options?: { markSent?: boolean }
): Promise<{ runId: string; accessToken: string }> {
  const existing = await supabase
    .from("shift_checklist_runs")
    .select("id")
    .eq("employee_shift_id", shift.id)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    const full = await supabase
      .from("shift_checklist_runs")
      .select("id, access_token")
      .eq("id", existing.data.id)
      .single();
    if (full.error) throw new Error(full.error.message);
    return { runId: full.data.id as string, accessToken: full.data.access_token as string };
  }

  const checklist = await findChecklistForShift(supabase, shift);
  if (!checklist) {
    throw new Error("No active checklist matches this shift (role + shift type + location).");
  }

  const items = await supabase
    .from("checklist_items")
    .select("id, sort_order, task_text, task_key")
    .eq("checklist_id", checklist.id)
    .order("sort_order", { ascending: true });
  if (items.error) throw new Error(items.error.message);
  const itemRows = items.data ?? [];
  if (itemRows.length === 0) {
    throw new Error("Checklist has no items yet.");
  }

  const accessToken = generateChecklistAccessToken();
  const now = new Date().toISOString();
  const runInsert = await supabase
    .from("shift_checklist_runs")
    .insert({
      organization_id: shift.organization_id,
      employee_shift_id: shift.id,
      checklist_id: checklist.id,
      access_token: accessToken,
      status: options?.markSent ? "sent" : "pending",
      sent_at: options?.markSent ? now : null,
    })
    .select("id")
    .single();
  if (runInsert.error) {
    if (runInsert.error.code === "23505") {
      const recovered = await supabase
        .from("shift_checklist_runs")
        .select("id, access_token")
        .eq("employee_shift_id", shift.id)
        .single();
      if (!recovered.error && recovered.data) {
        return {
          runId: recovered.data.id as string,
          accessToken: recovered.data.access_token as string,
        };
      }
    }
    throw new Error(runInsert.error.message);
  }
  const runId = runInsert.data.id as string;

  const runItems = itemRows.map((it) => {
    const tk = (it as { task_key?: string | null }).task_key;
    const text = it.task_text as string;
    return {
      shift_checklist_run_id: runId,
      checklist_item_id: it.id as string,
      task_text_snapshot: text,
      task_key_snapshot: normalizeTaskKey(tk?.trim() ? tk : text),
      assigned_employee_id: shift.employee_id,
      override_source: "template" as const,
    };
  });
  const ri = await supabase.from("shift_checklist_run_items").insert(runItems);
  if (ri.error) throw new Error(ri.error.message);

  void recordFairnessForAllRunItemsOnRun({
    organizationId: shift.organization_id,
    runId,
    source: "checklist_run_created",
  });

  if (options?.markSent) {
    await supabase
      .from("employee_shifts")
      .update({ status: "sent", updated_at: now })
      .eq("id", shift.id);
  }

  return { runId, accessToken };
}
