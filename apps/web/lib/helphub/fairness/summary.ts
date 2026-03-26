import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchOrCreateOrganizationFairnessSettings } from "./fairness-settings";

export type EmployeeFairnessSummary = {
  employeeId: string;
  preferredTaskAssigned: number;
  avoidedTaskAssigned: number;
  preferredShiftAssigned: number;
  avoidedShiftAssigned: number;
  /** Counts voluntary_shift_pickup + legacy extra_shift_awarded + extra_hours_awarded (each is one ledger row). */
  voluntaryShiftPickups: number;
  undesirableTaskRepeated: number;
  undesirableShiftRepeated: number;
};

export type FairnessLedgerRowLite = {
  id: string;
  created_at: string;
  event_type: string;
  preference_key: string | null;
  fairness_category: string;
  employee_shift_id: string | null;
  shift_checklist_run_id: string | null;
  shift_checklist_run_item_id: string | null;
  shift_run_override_task_id: string | null;
  metadata: Record<string, unknown>;
};

function sinceIso(lookbackDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - lookbackDays);
  return d.toISOString();
}

function accumulateEvent(base: EmployeeFairnessSummary, t: string): void {
  if (t === "preferred_task_assigned") base.preferredTaskAssigned += 1;
  else if (t === "avoided_task_assigned") base.avoidedTaskAssigned += 1;
  else if (t === "preferred_shift_assigned") base.preferredShiftAssigned += 1;
  else if (t === "avoided_shift_assigned") base.avoidedShiftAssigned += 1;
  else if (
    t === "voluntary_shift_pickup" ||
    t === "extra_shift_awarded" ||
    t === "extra_hours_awarded"
  ) {
    base.voluntaryShiftPickups += 1;
  } else if (t === "undesirable_task_repeated") base.undesirableTaskRepeated += 1;
  else if (t === "undesirable_shift_repeated") base.undesirableShiftRepeated += 1;
}

export async function getEmployeeFairnessSummary(
  supabase: SupabaseClient,
  organizationId: string,
  employeeId: string,
  lookbackDays?: number
): Promise<EmployeeFairnessSummary> {
  const settings = await fetchOrCreateOrganizationFairnessSettings(supabase, organizationId);
  const days = lookbackDays ?? settings.fairness_lookback_days;
  const since = sinceIso(days);

  const base: EmployeeFairnessSummary = {
    employeeId,
    preferredTaskAssigned: 0,
    avoidedTaskAssigned: 0,
    preferredShiftAssigned: 0,
    avoidedShiftAssigned: 0,
    voluntaryShiftPickups: 0,
    undesirableTaskRepeated: 0,
    undesirableShiftRepeated: 0,
  };

  const { data: rows, error } = await supabase
    .from("fairness_assignment_ledger")
    .select("event_type")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .gte("created_at", since);
  if (error || !rows) return base;

  for (const r of rows) {
    accumulateEvent(base, (r as { event_type: string }).event_type);
  }

  return base;
}

export type FairnessDashboardRow = EmployeeFairnessSummary & { fullName: string };

export async function getFairnessDashboard(
  supabase: SupabaseClient,
  organizationId: string,
  filters: {
    locationId?: string;
    staffRoleId?: string;
    fromDate?: string;
    toDate?: string;
  }
): Promise<{ rows: FairnessDashboardRow[]; lookbackDays: number }> {
  const settings = await fetchOrCreateOrganizationFairnessSettings(supabase, organizationId);
  const since =
    filters.fromDate ??
    new Date(Date.now() - settings.fairness_lookback_days * 864e5).toISOString().slice(0, 10);
  const sinceIsoStr = new Date(`${since}T00:00:00Z`).toISOString();
  const toIso = filters.toDate
    ? new Date(`${filters.toDate}T23:59:59Z`).toISOString()
    : new Date().toISOString();

  let shiftFilterIds: string[] | null = null;
  if (filters.locationId || filters.staffRoleId) {
    let q = supabase
      .from("employee_shifts")
      .select("id")
      .eq("organization_id", organizationId)
      .gte("shift_date", since.slice(0, 10))
      .lte("shift_date", filters.toDate ?? "9999-12-31");
    if (filters.locationId) q = q.eq("location_id", filters.locationId);
    if (filters.staffRoleId) q = q.eq("staff_role_id", filters.staffRoleId);
    const { data: sh } = await q;
    shiftFilterIds = (sh ?? []).map((r) => r.id as string);
    if (shiftFilterIds.length === 0) {
      return { rows: [], lookbackDays: settings.fairness_lookback_days };
    }
  }

  const ledgerQuery = supabase
    .from("fairness_assignment_ledger")
    .select("employee_id, event_type, employee_shift_id")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIsoStr)
    .lte("created_at", toIso);

  const { data: ledgerRows, error } = await ledgerQuery;
  if (error) throw new Error(error.message);

  let rows = ledgerRows ?? [];
  if (shiftFilterIds) {
    const set = new Set(shiftFilterIds);
    rows = rows.filter((r) => {
      const sid = (r as { employee_shift_id: string | null }).employee_shift_id;
      return sid && set.has(sid);
    });
  }

  const byEmp = new Map<string, EmployeeFairnessSummary>();
  for (const r of rows) {
    const row = r as { employee_id: string; event_type: string };
    let agg = byEmp.get(row.employee_id);
    if (!agg) {
      agg = {
        employeeId: row.employee_id,
        preferredTaskAssigned: 0,
        avoidedTaskAssigned: 0,
        preferredShiftAssigned: 0,
        avoidedShiftAssigned: 0,
        voluntaryShiftPickups: 0,
        undesirableTaskRepeated: 0,
        undesirableShiftRepeated: 0,
      };
      byEmp.set(row.employee_id, agg);
    }
    accumulateEvent(agg, row.event_type);
  }

  const empIds = [...byEmp.keys()];
  if (empIds.length === 0) return { rows: [], lookbackDays: settings.fairness_lookback_days };

  const { data: emps } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .in("id", empIds);

  const nameById = new Map((emps ?? []).map((e) => [e.id as string, e.full_name as string]));

  const out: FairnessDashboardRow[] = [...byEmp.values()].map((agg) => ({
    ...agg,
    fullName: nameById.get(agg.employeeId) ?? agg.employeeId.slice(0, 8),
  }));
  out.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return { rows: out, lookbackDays: settings.fairness_lookback_days };
}

/** Traceability: raw ledger rows for one employee in the dashboard time window. */
export async function getFairnessLedgerDrillDown(
  supabase: SupabaseClient,
  organizationId: string,
  employeeId: string,
  fromIso: string,
  toIso: string,
  limit = 120
): Promise<FairnessLedgerRowLite[]> {
  const { data, error } = await supabase
    .from("fairness_assignment_ledger")
    .select(
      "id, created_at, event_type, preference_key, fairness_category, employee_shift_id, shift_checklist_run_id, shift_checklist_run_item_id, shift_run_override_task_id, metadata"
    )
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as FairnessLedgerRowLite[];
}
