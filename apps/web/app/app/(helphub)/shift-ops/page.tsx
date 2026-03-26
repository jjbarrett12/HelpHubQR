import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calendarDateInTimeZone, DEFAULT_TIMEZONE } from "@/lib/date";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { userCanManageOrganization } from "@/lib/helphub/require-org";
import { fetchOrCreateWorkforceSettings } from "@/lib/helphub/workforce/settings";
import type { ShiftBriefingNoteRow } from "@/components/helphub/shift-ops/ShiftBriefingNotesPanel";
import {
  ManagerShiftOpsClient,
  type ShiftOpsEvent,
  type ShiftOpsOverride,
  type ShiftOpsPendingCoverage,
  type ShiftOpsPendingTrade,
  type ShiftOpsPendingTransfer,
  type ShiftOpsRunItem,
  type ShiftOpsShiftRow,
} from "@/components/helphub/shift-ops/ManagerShiftOpsClient";
import { Button } from "@/components/ui/button";
import type { ShiftType } from "@/lib/helphub/types";
import {
  evaluateShiftFairnessSignal,
  getFairnessWarningsForRunAssignment,
} from "@/lib/helphub/fairness/evaluate";
import { ledgerTaskKeyFromSnapshots } from "@/lib/helphub/fairness/task-key";
import { getTaskKeyDisplayLabel, type TaxonomyRow } from "@/lib/helphub/task-taxonomy";

const SHIFT_TYPES: ShiftType[] = ["open", "mid", "close", "custom"];

export default async function ShiftOpsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const scheduleTz = process.env.CRON_SCHEDULE_TZ?.trim() || DEFAULT_TIMEZONE;
  const rawDate = searchParams.date;
  const dateStr =
    typeof rawDate === "string" && rawDate.length > 0 ? rawDate : calendarDateInTimeZone(scheduleTz);

  const rawLoc = searchParams.location;
  const locationFilter =
    typeof rawLoc === "string" && rawLoc.length > 0 ? rawLoc : "";

  const rawType = searchParams.shiftType;
  const shiftTypeFilter =
    typeof rawType === "string" && SHIFT_TYPES.includes(rawType as ShiftType)
      ? (rawType as ShiftType)
      : "";

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-lg font-semibold">Shift operations</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an organization above.</p>
      </div>
    );
  }

  const canManage = await userCanManageOrganization(supabase, user.id, orgId);
  if (!canManage) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-lg font-semibold">Shift operations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only organization owners, managers, and admins can use the operations board.
        </p>
      </div>
    );
  }

  const { data: taxonomyRows } = await supabase
    .from("task_taxonomy")
    .select("task_key, display_label, is_active")
    .eq("organization_id", orgId);
  const taxonomy = (taxonomyRows ?? []) as TaxonomyRow[];

  let q = supabase
    .from("employee_shifts")
    .select(
      `
      id,
      employee_id,
      shift_date,
      shift_type,
      location_id,
      staff_role_id,
      is_open_for_claim,
      status,
      employees ( full_name ),
      locations ( name ),
      staff_roles ( name )
    `
    )
    .eq("organization_id", orgId)
    .eq("shift_date", dateStr)
    .order("created_at", { ascending: true });

  if (locationFilter) q = q.eq("location_id", locationFilter);
  if (shiftTypeFilter) q = q.eq("shift_type", shiftTypeFilter);

  const [{ data: shiftRows }, { data: locations }, { data: employeeRows }, workforceSettings] =
    await Promise.all([
      q,
      supabase.from("locations").select("id, name").eq("organization_id", orgId).order("name"),
      supabase.from("employees").select("id, full_name").eq("organization_id", orgId).eq("is_active", true).order("full_name"),
      fetchOrCreateWorkforceSettings(supabase, orgId),
    ]);

  const shifts = shiftRows ?? [];
  const shiftIds = shifts.map((s) => s.id as string);

  const { data: briefingRows } =
    shiftIds.length > 0
      ? await supabase
          .from("shift_notes")
          .select("id, employee_shift_id, note, created_at, visible_to_employee")
          .eq("organization_id", orgId)
          .in("employee_shift_id", shiftIds)
          .order("created_at", { ascending: true })
      : { data: [] as Record<string, unknown>[] };

  const briefingByShift = new Map<string, ShiftBriefingNoteRow[]>();
  for (const row of briefingRows ?? []) {
    const r = row as {
      id: string;
      employee_shift_id: string;
      note: string;
      created_at: string;
      visible_to_employee: boolean;
    };
    const list = briefingByShift.get(r.employee_shift_id) ?? [];
    list.push({
      id: r.id,
      note: r.note,
      created_at: r.created_at,
      visible_to_employee: r.visible_to_employee,
    });
    briefingByShift.set(r.employee_shift_id, list);
  }

  const { data: runs } =
    shiftIds.length > 0
      ? await supabase
          .from("shift_checklist_runs")
          .select("id, employee_shift_id, access_token, status")
          .eq("organization_id", orgId)
          .in("employee_shift_id", shiftIds)
      : { data: [] as Record<string, unknown>[] };

  const runByShift = new Map<string, { id: string; access_token: string; status: string }>();
  const runIds: string[] = [];
  for (const r of runs ?? []) {
    const row = r as {
      id: string;
      employee_shift_id: string;
      access_token: string;
      status: string;
    };
    runByShift.set(row.employee_shift_id, {
      id: row.id,
      access_token: row.access_token,
      status: row.status,
    });
    runIds.push(row.id);
  }
  const runIdSet = new Set(runIds);

  const { data: itemRows } =
    runIds.length > 0
      ? await supabase
          .from("shift_checklist_run_items")
          .select(
            "id, shift_checklist_run_id, task_text_snapshot, task_key_snapshot, completed, assigned_employee_id, suppressed, assignment_status, override_source"
          )
          .in("shift_checklist_run_id", runIds)
          .order("created_at", { ascending: true })
      : { data: [] as Record<string, unknown>[] };

  const itemsByRun = new Map<string, ShiftOpsRunItem[]>();
  for (const row of itemRows ?? []) {
    const it = row as ShiftOpsRunItem & { shift_checklist_run_id: string };
    const { shift_checklist_run_id: rid, ...rest } = it;
    const list = itemsByRun.get(rid) ?? [];
    list.push({
      ...rest,
      task_key_snapshot: rest.task_key_snapshot ?? null,
    });
    itemsByRun.set(rid, list);
  }

  const { data: overrideRows } =
    runIds.length > 0
      ? await supabase
          .from("shift_run_override_tasks")
          .select("id, run_id, task_text_snapshot, task_key_snapshot, assigned_employee_id, status")
          .eq("organization_id", orgId)
          .in("run_id", runIds)
          .order("sort_order", { ascending: true })
      : { data: [] as Record<string, unknown>[] };

  const overridesByRun = new Map<string, ShiftOpsOverride[]>();
  for (const row of overrideRows ?? []) {
    const o = row as ShiftOpsOverride & { run_id: string };
    const { run_id: rid, ...rest } = o;
    const list = overridesByRun.get(rid) ?? [];
    list.push(rest);
    overridesByRun.set(rid, list);
  }

  const empName = (id: string) =>
    (employeeRows ?? []).find((e) => e.id === id)?.full_name ?? id.slice(0, 8);

  const { data: transferRows } = await supabase
    .from("shift_task_transfer_requests")
    .select(
      `
      id,
      run_id,
      status,
      request_mode,
      from_employee_id,
      to_employee_id,
      manager_approval_required,
      shift_checklist_run_items ( task_text_snapshot )
    `
    )
    .eq("organization_id", orgId)
    .in("status", ["pending", "accepted"]);

  const pendingTransfers: ShiftOpsPendingTransfer[] = (transferRows ?? [])
    .filter((t) => runIdSet.has((t as { run_id: string }).run_id))
    .map((t) => {
      const row = t as {
        id: string;
        run_id: string;
        status: string;
        request_mode: string;
        from_employee_id: string;
        to_employee_id: string | null;
        manager_approval_required: boolean;
        shift_checklist_run_items:
          | { task_text_snapshot: string | null }
          | { task_text_snapshot: string | null }[]
          | null;
      };
      const nested = row.shift_checklist_run_items;
      const snap = Array.isArray(nested)
        ? nested[0]?.task_text_snapshot
        : nested?.task_text_snapshot;
      const taskPreview = snap ?? "(task)";
      return {
        id: row.id,
        run_id: row.run_id,
        status: row.status,
        request_mode: row.request_mode,
        task_preview: taskPreview,
        from_name: empName(row.from_employee_id),
        to_name: row.to_employee_id ? empName(row.to_employee_id) : null,
        manager_approval_required: row.manager_approval_required,
      };
    });

  const { data: coverageRows } = await supabase
    .from("shift_coverage_requests")
    .select(
      "id, employee_shift_id, status, request_type, reason, requested_by_employee_id, claimed_by_employee_id, manager_approval_required"
    )
    .eq("organization_id", orgId)
    .in("status", ["pending", "claimed"]);

  const shiftIdSet = new Set(shiftIds);
  const pendingCoverage: ShiftOpsPendingCoverage[] = (coverageRows ?? [])
    .filter((c) => shiftIdSet.has((c as { employee_shift_id: string }).employee_shift_id))
    .map((c) => {
      const row = c as {
        id: string;
        employee_shift_id: string;
        status: string;
        request_type: string;
        reason: string | null;
        requested_by_employee_id: string;
        claimed_by_employee_id: string | null;
        manager_approval_required: boolean;
      };
      return {
        id: row.id,
        employee_shift_id: row.employee_shift_id,
        status: row.status,
        request_type: row.request_type,
        reason: row.reason,
        requested_by_name: empName(row.requested_by_employee_id),
        claimed_by_name: row.claimed_by_employee_id
          ? empName(row.claimed_by_employee_id)
          : null,
        manager_approval_required: row.manager_approval_required,
      };
    });

  const { data: tradeRows } = await supabase
    .from("shift_trade_offers")
    .select(
      "id, status, reason, offering_employee_id, target_employee_id, accepted_by_employee_id, manager_approval_required, offered_shift_id, requested_shift_id"
    )
    .eq("organization_id", orgId)
    .in("status", ["pending", "accepted"]);

  const pendingTrades: ShiftOpsPendingTrade[] = (tradeRows ?? [])
    .filter((tr) => {
      const row = tr as { offered_shift_id: string; requested_shift_id: string | null };
      return (
        shiftIdSet.has(row.offered_shift_id) ||
        (!!row.requested_shift_id && shiftIdSet.has(row.requested_shift_id))
      );
    })
    .map((tr) => {
      const row = tr as {
        id: string;
        status: string;
        reason: string | null;
        offering_employee_id: string;
        target_employee_id: string | null;
        accepted_by_employee_id: string | null;
        manager_approval_required: boolean;
      };
      return {
        id: row.id,
        status: row.status,
        reason: row.reason,
        offering_name: empName(row.offering_employee_id),
        target_name: row.target_employee_id ? empName(row.target_employee_id) : null,
        accepted_by_name: row.accepted_by_employee_id
          ? empName(row.accepted_by_employee_id)
          : null,
        manager_approval_required: row.manager_approval_required,
      };
    });

  const { data: eventRows } = await supabase
    .from("workforce_event_log")
    .select("id, event_type, created_at, payload, employee_shift_id, shift_checklist_run_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(60);

  const recentEvents: ShiftOpsEvent[] = (eventRows ?? [])
    .filter((e) => {
      const row = e as {
        employee_shift_id: string | null;
        shift_checklist_run_id: string | null;
      };
      if (!row.employee_shift_id && !row.shift_checklist_run_id) return true;
      if (row.employee_shift_id && shiftIdSet.has(row.employee_shift_id)) return true;
      if (row.shift_checklist_run_id && runIdSet.has(row.shift_checklist_run_id)) return true;
      return false;
    })
    .slice(0, 35)
    .map((e) => {
      const row = e as {
        id: string;
        event_type: string;
        created_at: string;
        payload: Record<string, unknown>;
      };
      return {
        id: row.id,
        event_type: row.event_type,
        created_at: row.created_at,
        payload: row.payload ?? {},
      };
    });

  const shiftPayload: ShiftOpsShiftRow[] = shifts.map((s) => {
    const em = s as {
      id: string;
      employee_id: string;
      shift_type: string;
      employees: { full_name: string } | { full_name: string }[] | null;
      locations: { name: string } | { name: string }[] | null;
      staff_roles: { name: string } | { name: string }[] | null;
      is_open_for_claim: boolean;
    };
    const empObj = Array.isArray(em.employees) ? em.employees[0] : em.employees;
    const locObj = Array.isArray(em.locations) ? em.locations[0] : em.locations;
    const roleObj = Array.isArray(em.staff_roles) ? em.staff_roles[0] : em.staff_roles;
    const run = runByShift.get(s.id as string) ?? null;
    return {
      id: s.id as string,
      employee_id: em.employee_id,
      employee_name: empObj?.full_name ?? "Unknown",
      shift_type: em.shift_type,
      location_name: locObj?.name ?? null,
      role_name: roleObj?.name ?? "—",
      is_open_for_claim: em.is_open_for_claim,
      run,
      items: run ? itemsByRun.get(run.id) ?? [] : [],
      overrides: run ? overridesByRun.get(run.id) ?? [] : [],
      briefingNotes: briefingByShift.get(s.id as string) ?? [],
    };
  });

  const fairnessHints: Record<string, string[]> = {};
  const taskKeyLabels: Record<string, string> = {};
  for (const s of shiftPayload) {
    const shSig = await evaluateShiftFairnessSignal(supabase, orgId, {
      employeeId: s.employee_id,
      shiftType: s.shift_type,
      shiftDate: dateStr,
    });
    fairnessHints[`shift:${s.id}`] = shSig.hints;
    for (const it of s.items) {
      const k = ledgerTaskKeyFromSnapshots(it.task_key_snapshot, it.task_text_snapshot);
      taskKeyLabels[it.id] = getTaskKeyDisplayLabel(k, taxonomy);
      fairnessHints[it.id] = await getFairnessWarningsForRunAssignment(supabase, orgId, {
        taskKeySnapshot: it.task_key_snapshot,
        taskTextSnapshot: it.task_text_snapshot,
        assignedEmployeeId: it.assigned_employee_id,
      });
    }
    for (const o of s.overrides) {
      const k = ledgerTaskKeyFromSnapshots(o.task_key_snapshot ?? null, o.task_text_snapshot);
      taskKeyLabels[`override:${o.id}`] = getTaskKeyDisplayLabel(k, taxonomy);
      if (o.status === "active") {
        const effectiveAssignee = o.assigned_employee_id ?? s.employee_id;
        fairnessHints[`override:${o.id}`] = await getFairnessWarningsForRunAssignment(supabase, orgId, {
          taskKeySnapshot: o.task_key_snapshot ?? null,
          taskTextSnapshot: o.task_text_snapshot,
          assignedEmployeeId: effectiveAssignee,
        });
      }
    }
  }

  const employees = (employeeRows ?? []).map((e) => ({
    id: e.id as string,
    full_name: e.full_name as string,
  }));

  const queryBase = `/app/shift-ops?date=${encodeURIComponent(dateStr)}`;
  const withFilters =
    queryBase +
    (locationFilter ? `&location=${encodeURIComponent(locationFilter)}` : "") +
    (shiftTypeFilter ? `&shiftType=${encodeURIComponent(shiftTypeFilter)}` : "");

  return (
    <div className="min-h-full">
      <div className="border-b bg-card/40 px-4 py-4 md:px-6 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold">Shift operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tonight&apos;s tasks, overrides, and pending approvals for {dateStr}.
          </p>
        </div>
        <form method="get" className="flex flex-wrap gap-3 items-end ml-auto">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor="shift-ops-date">
              Date
            </label>
            <InputDate id="shift-ops-date" name="date" defaultValue={dateStr} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor="shift-ops-loc">
              Location
            </label>
            <select
              id="shift-ops-loc"
              name="location"
              defaultValue={locationFilter}
              className="border rounded-md px-2 py-2 text-sm h-10 bg-background min-w-[160px]"
            >
              <option value="">All</option>
              {(locations ?? []).map((l) => (
                <option key={l.id as string} value={l.id as string}>
                  {l.name as string}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor="shift-ops-type">
              Shift type
            </label>
            <select
              id="shift-ops-type"
              name="shiftType"
              defaultValue={shiftTypeFilter}
              className="border rounded-md px-2 py-2 text-sm h-10 bg-background min-w-[120px]"
            >
              <option value="">All</option>
              {SHIFT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Apply
          </Button>
        </form>
        <Button variant="outline" size="sm" asChild>
          <Link href={withFilters}>Refresh</Link>
        </Button>
      </div>

      <ManagerShiftOpsClient
        workforceSettings={workforceSettings}
        shifts={shiftPayload}
        employees={employees}
        pendingTransfers={pendingTransfers}
        pendingCoverage={pendingCoverage}
        pendingTrades={pendingTrades}
        recentEvents={recentEvents}
        fairnessHints={fairnessHints}
        taskKeyLabels={taskKeyLabels}
        overrideTaxonomy={taxonomy.filter((t) => t.is_active !== false)}
      />
    </div>
  );
}

/** Native date input; name only on the visible control for GET form (hidden duplicate removed when using single input). */
function InputDate({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <input
      id={id}
      type="date"
      name={name}
      defaultValue={defaultValue}
      className="border rounded-md px-2 py-2 text-sm h-10 bg-background"
    />
  );
}
