import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { ChecklistRunsClient, type ChecklistRunRow } from "@/components/operations/ChecklistRunsClient";
import {
  ShiftChecklistRunsClient,
  type ShiftRunRow,
} from "@/components/helphub/ShiftChecklistRunsClient";
import type { ShiftChecklistRunStatus } from "@/lib/helphub/types";
import { fetchOrCreateDeliverySettings } from "@/lib/delivery/checklist-delivery";
import { buildDeliveryChannelHints, indexLatestDeliveriesByRun } from "@/lib/delivery/delivery-status";

export const dynamic = "force-dynamic";

function one<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}

const HH_FILTERS = new Set(["pending", "sent", "opened", "completed", "expired", "all"]);

type RunRowWithContact = ShiftRunRow & { phonePresent: boolean; emailPresent: boolean };

export default async function ChecklistRunsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filterParam = searchParams.filter;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);

  if (orgId) {
    const hhFilter =
      filterParam && HH_FILTERS.has(filterParam)
        ? (filterParam as "all" | ShiftChecklistRunStatus)
        : "all";

    const { data: orgRow } = await supabase.from("organizations").select("name").eq("id", orgId).single();
    const deliverySettings = await fetchOrCreateDeliverySettings(supabase, orgId);

    const { data: runRows, error: runErr } = await supabase
      .from("shift_checklist_runs")
      .select(
        `
        id,
        status,
        updated_at,
        sent_at,
        checklist:checklists(name),
        employee_shift:employee_shifts(
          shift_date,
          employee:employees(full_name, phone, email),
          staff_role:staff_roles(name)
        )
      `
      )
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(400);

    if (runErr) {
      return (
        <div className="p-8 max-w-lg">
          <h1 className="text-lg font-semibold">Checklist runs</h1>
          <p className="mt-2 text-sm text-destructive">{runErr.message}</p>
        </div>
      );
    }

  const runsBase: RunRowWithContact[] = (runRows ?? []).map((raw) => {
    const checklist = one(raw.checklist as { name: string } | { name: string }[] | null);
    const es = one(
      raw.employee_shift as unknown as {
        shift_date: string;
        employee:
          | { full_name: string; phone: string | null; email: string | null }
          | { full_name: string; phone: string | null; email: string | null }[]
          | null;
        staff_role: { name: string } | { name: string }[] | null;
      } | null
    );
    const emp = one(es?.employee ?? null);
    const role = one(es?.staff_role ?? null);
    const phonePresent = Boolean((emp?.phone ?? "").trim());
    const emailPresent = Boolean((emp?.email ?? "").trim());
    return {
      id: raw.id as string,
      status: raw.status as ShiftChecklistRunStatus,
      updated_at: raw.updated_at as string,
      sent_at: (raw.sent_at as string | null) ?? null,
      checklistName: checklist?.name ?? "Checklist",
      employeeName: emp?.full_name ?? "Employee",
      roleName: role?.name ?? "Role",
      shiftDate: es?.shift_date ?? "—",
      phonePresent,
      emailPresent,
    };
  });

  const runIds = runsBase.map((r) => r.id);
  const { data: itemRows } =
    runIds.length > 0
      ? await supabase
          .from("shift_checklist_run_items")
          .select("shift_checklist_run_id, completed, checklist_item_id")
          .in("shift_checklist_run_id", runIds)
      : { data: [] as Record<string, unknown>[] };

  const checklistItemIds = [...new Set((itemRows ?? []).map((i) => i.checklist_item_id as string))];
  const { data: checklistItems } =
    checklistItemIds.length > 0
      ? await supabase.from("checklist_items").select("id, task_text, sort_order").in("id", checklistItemIds)
      : { data: [] as { id: string; task_text: string; sort_order: number }[] };

  const metaById = new Map(
    (checklistItems ?? []).map((c) => [c.id, { taskText: c.task_text, sortOrder: c.sort_order }])
  );
  const itemsByRun = new Map<string, Array<{ taskText: string; completed: boolean; sortOrder: number }>>();
  for (const it of itemRows ?? []) {
    const rid = it.shift_checklist_run_id as string;
    const arr = itemsByRun.get(rid) ?? [];
    const meta = metaById.get(it.checklist_item_id as string);
    arr.push({
      taskText: meta?.taskText ?? "Task",
      completed: Boolean(it.completed),
      sortOrder: meta?.sortOrder ?? 0,
    });
    itemsByRun.set(rid, arr);
  }
  for (const [, arr] of itemsByRun) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const { data: deliveryRows } =
    runIds.length > 0
      ? await supabase
          .from("message_deliveries")
          .select("shift_checklist_run_id, channel, status, error_message, sent_at, created_at")
          .eq("organization_id", orgId)
          .in("shift_checklist_run_id", runIds)
          .order("created_at", { ascending: false })
      : { data: [] as Record<string, unknown>[] };

  const latestByRun = indexLatestDeliveriesByRun(
    (deliveryRows ?? []).map((row) => ({
      shift_checklist_run_id: row.shift_checklist_run_id as string,
      channel: row.channel as string,
      status: row.status as string,
      error_message: (row.error_message as string | null) ?? null,
      sent_at: (row.sent_at as string | null) ?? null,
    }))
  );

  const runs: ShiftRunRow[] = runsBase.map((r) => {
    const { phonePresent, emailPresent, ...base } = r;
    const rawItems = itemsByRun.get(r.id) ?? [];
    const latest = latestByRun.get(r.id) ?? {};
    const deliveryHints = buildDeliveryChannelHints({
      orgSendSms: deliverySettings.send_sms,
      orgSendEmail: deliverySettings.send_email,
      phonePresent,
      emailPresent,
      latest,
    });
    return {
      ...base,
      items: rawItems.map(({ taskText, completed }) => ({ taskText, completed })),
      deliveryHints,
    };
  });

  return (
      <ShiftChecklistRunsClient
        organizationName={orgRow?.name ?? "Organization"}
        runs={runs}
        initialFilter={hhFilter}
      />
    );
  }

  const initialFilter =
    filterParam && ["open", "active", "done", "escalated", "overdue", "all"].includes(filterParam)
      ? (filterParam as "open" | "active" | "done" | "escalated" | "overdue" | "all")
      : "all";

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("supervisor_profiles")
    .select("property_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.property_id) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-lg font-semibold text-foreground">Checklist runs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Join an organization (top bar) or get supervisor access to a property to view runs.
        </p>
      </div>
    );
  }

  const propertyId = profile.property_id as string;
  const { data: property } = await admin.from("properties").select("name").eq("id", propertyId).single();

  const since = new Date();
  since.setDate(since.getDate() - 21);

  const [{ data: taskRows }, { data: escalatedRows }] = await Promise.all([
    admin
      .from("tasks")
      .select(
        `
        id,
        status,
        sla_minutes,
        created_at,
        completed_at,
        location:locations(identifier, type),
        request_type:request_types(code, label, department)
      `
      )
      .eq("property_id", propertyId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(400),
    admin.from("task_events").select("task_id").eq("property_id", propertyId).eq("event_type", "escalated"),
  ]);

  const escalatedIds = new Set((escalatedRows ?? []).map((r) => r.task_id));

  const tasks: ChecklistRunRow[] = (taskRows ?? []).map((raw) => {
    const t = raw as {
      id: string;
      status: string;
      sla_minutes: number;
      created_at: string;
      completed_at: string | null;
      location: unknown;
      request_type: unknown;
    };
    const locRaw = t.location as { identifier: string; type: string } | { identifier: string; type: string }[] | null;
    const rtRaw = t.request_type as
      | { code: string; label: string; department: string }
      | { code: string; label: string; department: string }[]
      | null;
    const location = Array.isArray(locRaw) ? locRaw[0] ?? null : locRaw;
    const request_type = Array.isArray(rtRaw) ? rtRaw[0] ?? null : rtRaw;
    return {
      id: t.id,
      status: t.status,
      created_at: t.created_at,
      sla_minutes: t.sla_minutes,
      completed_at: t.completed_at,
      location,
      request_type,
      escalated: escalatedIds.has(t.id),
    };
  });

  return (
    <ChecklistRunsClient
      propertyName={property?.name ?? "Property"}
      tasks={tasks}
      initialFilter={initialFilter}
    />
  );
}
