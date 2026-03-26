import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkforceEventInput = {
  organization_id: string;
  event_type: string;
  actor_user_id?: string | null;
  actor_employee_id?: string | null;
  employee_shift_id?: string | null;
  shift_checklist_run_id?: string | null;
  shift_checklist_run_item_id?: string | null;
  /** When the event concerns a one-off override task (not a template run item). */
  shift_run_override_task_id?: string | null;
  related_request_id?: string | null;
  payload?: Record<string, unknown>;
};

export async function logWorkforceEvent(supabase: SupabaseClient, e: WorkforceEventInput): Promise<void> {
  const { error } = await supabase.from("workforce_event_log").insert({
    organization_id: e.organization_id,
    event_type: e.event_type,
    actor_user_id: e.actor_user_id ?? null,
    actor_employee_id: e.actor_employee_id ?? null,
    employee_shift_id: e.employee_shift_id ?? null,
    shift_checklist_run_id: e.shift_checklist_run_id ?? null,
    shift_checklist_run_item_id: e.shift_checklist_run_item_id ?? null,
    shift_run_override_task_id: e.shift_run_override_task_id ?? null,
    related_request_id: e.related_request_id ?? null,
    payload: e.payload ?? {},
  });
  if (error) console.error("workforce_event_log insert failed", error.message);
}
