import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { userCanManageOrganization } from "@/lib/helphub/require-org";
import { fetchOrCreateOrganizationFairnessSettings } from "@/lib/helphub/fairness/fairness-settings";
import { getFairnessDashboard, getFairnessLedgerDrillDown } from "@/lib/helphub/fairness/summary";
import { updateOrganizationFairnessSettingsFormAction } from "@/app/app/helphub/actions/fairness-preferences";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  fetchTaskKeyManagerInsights,
  getTaskKeyDisplayLabel,
  type TaxonomyRow,
} from "@/lib/helphub/task-taxonomy";

function ledgerTaskWorkSource(ev: {
  shift_checklist_run_item_id: string | null;
  shift_run_override_task_id: string | null;
  metadata?: Record<string, unknown>;
}): string {
  if (ev.shift_run_override_task_id) return "Override task";
  if (ev.shift_checklist_run_item_id) return "Template task";
  const src = ev.metadata?.task_assignment_source;
  if (src === "override_task") return "Override task";
  if (src === "template_run_item") return "Template task";
  return "—";
}

function fairnessQueryHref(q: {
  location?: string;
  role?: string;
  from?: string;
  to?: string;
  employee?: string;
}) {
  const p = new URLSearchParams();
  if (q.location) p.set("location", q.location);
  if (q.role) p.set("role", q.role);
  if (q.from) p.set("from", q.from);
  if (q.to) p.set("to", q.to);
  if (q.employee) p.set("employee", q.employee);
  const s = p.toString();
  return s ? `/app/fairness?${s}` : "/app/fairness";
}

export default async function FairnessPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Select an organization first.</p>
      </div>
    );
  }

  const canManage = await userCanManageOrganization(supabase, user.id, orgId);
  if (!canManage) {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-lg font-semibold">Fairness</h1>
        <p className="text-sm text-muted-foreground mt-2">Only managers can view org fairness analytics.</p>
      </div>
    );
  }

  const loc =
    typeof searchParams.location === "string" && searchParams.location.length > 0
      ? searchParams.location
      : undefined;
  const role =
    typeof searchParams.role === "string" && searchParams.role.length > 0
      ? searchParams.role
      : undefined;
  const fromDate =
    typeof searchParams.from === "string" && searchParams.from.length > 0
      ? searchParams.from
      : undefined;
  const toDate =
    typeof searchParams.to === "string" && searchParams.to.length > 0 ? searchParams.to : undefined;
  const employeeDrillId =
    typeof searchParams.employee === "string" && searchParams.employee.length > 0
      ? searchParams.employee
      : undefined;

  const settings = await fetchOrCreateOrganizationFairnessSettings(supabase, orgId);
  const { data: taxonomyRows } = await supabase
    .from("task_taxonomy")
    .select("task_key, display_label, is_active")
    .eq("organization_id", orgId);
  const taxonomy = (taxonomyRows ?? []) as TaxonomyRow[];

  const taskKeyInsights = await fetchTaskKeyManagerInsights(supabase, orgId);

  const { rows, lookbackDays } = await getFairnessDashboard(supabase, orgId, {
    locationId: loc,
    staffRoleId: role,
    fromDate,
    toDate,
  });

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name");
  const { data: roles } = await supabase
    .from("staff_roles")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name");

  const sinceForWindow =
    fromDate ?? new Date(Date.now() - settings.fairness_lookback_days * 864e5).toISOString().slice(0, 10);
  const windowFromIso = new Date(`${sinceForWindow}T00:00:00Z`).toISOString();
  const windowToIso = toDate
    ? new Date(`${toDate}T23:59:59Z`).toISOString()
    : new Date().toISOString();

  const drillRows = employeeDrillId
    ? await getFairnessLedgerDrillDown(supabase, orgId, employeeDrillId, windowFromIso, windowToIso)
    : [];
  const drillName = rows.find((r) => r.employeeId === employeeDrillId)?.fullName ?? employeeDrillId;

  const maxAvoided = Math.max(0, ...rows.map((r) => r.avoidedTaskAssigned));
  const maxPickup = Math.max(0, ...rows.map((r) => r.voluntaryShiftPickups));

  return (
    <div className="min-h-full p-4 md:p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Fairness overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Advisory counts from the fairness ledger (one row per logged signal). They do not guarantee equity and do not
            drive assignments. Default lookback: {lookbackDays} days.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/shift-ops">Shift operations</Link>
        </Button>
      </div>

      <section className="border rounded-lg p-4 space-y-2 text-sm">
        <h2 className="text-sm font-semibold">Task key signals</h2>
        <p className="text-xs text-muted-foreground">
          Operational hygiene for fairness and preferences — execution still uses checklist and run snapshots only.
        </p>
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
          <li>
            <span className="text-foreground font-medium">
              {taskKeyInsights.uncategorizedChecklistItemCount}
            </span>{" "}
            uncategorized checklist lines (no explicit <code className="font-mono text-[10px]">task_key</code>)
          </li>
          <li>
            <span className="text-foreground font-medium">
              {taskKeyInsights.checklistItemsKeyWithoutTaxonomyLabel}
            </span>{" "}
            lines with a key missing an active taxonomy label
          </li>
          <li>
            <span className="text-foreground font-medium">
              {taskKeyInsights.reassignmentEvents.templateTask + taskKeyInsights.reassignmentEvents.overrideTask}
            </span>{" "}
            task reassignments logged in the last {taskKeyInsights.lookbackDays} days (template + override)
          </li>
        </ul>
        {taskKeyInsights.topUndesirableTaskKeys.length > 0 ? (
          <div className="text-xs pt-1">
            <span className="font-medium text-foreground">Most flagged undesirable keys: </span>
            {taskKeyInsights.topUndesirableTaskKeys.slice(0, 5).map((x, i) => (
              <span key={x.key}>
                {i > 0 ? " · " : ""}
                {getTaskKeyDisplayLabel(x.key, taxonomy)}{" "}
                <span className="font-mono text-muted-foreground">({x.key})</span>
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-xs pt-1">
          <Link href="/app/task-taxonomy" className="underline underline-offset-2">
            Task taxonomy
          </Link>
        </p>
      </section>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">Organization rules</h2>
        <form action={updateOrganizationFairnessSettingsFormAction} className="grid gap-3 text-sm max-w-xl">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="enable_fairness_warnings"
              defaultChecked={settings.enable_fairness_warnings}
            />
            Enable fairness hints on shift operations
          </label>
          <div>
            <label className="text-xs text-muted-foreground">Fairness lookback (days)</label>
            <input
              type="number"
              name="fairness_lookback_days"
              min={1}
              max={730}
              defaultValue={settings.fairness_lookback_days}
              className="mt-1 w-full border rounded-md px-2 py-2 bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Undesirable shift types (comma or newline)</label>
            <textarea
              name="undesirable_shift_types"
              rows={2}
              defaultValue={settings.undesirable_shift_types.join(", ")}
              className="mt-1 w-full border rounded-md px-2 py-2 bg-background font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Undesirable weekdays (0=Sun … 6=Sat, org schedule timezone)
            </label>
            <textarea
              name="undesirable_weekdays"
              rows={2}
              defaultValue={settings.undesirable_weekdays.join(", ")}
              className="mt-1 w-full border rounded-md px-2 py-2 bg-background font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Undesirable task keys (comma or newline)</label>
            <textarea
              name="undesirable_task_keys"
              rows={2}
              defaultValue={settings.undesirable_task_keys.join(", ")}
              className="mt-1 w-full border rounded-md px-2 py-2 bg-background font-mono text-xs"
            />
          </div>
          <Button type="submit" size="sm" className="w-fit">
            Save rules
          </Button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">Filters</h2>
        <form method="get" className="flex flex-wrap gap-3 items-end text-sm">
          {employeeDrillId ? <input type="hidden" name="employee" value={employeeDrillId} /> : null}
          <div>
            <label className="text-xs text-muted-foreground block">From</label>
            <input
              type="date"
              name="from"
              defaultValue={fromDate ?? ""}
              className="border rounded-md px-2 py-2 bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">To</label>
            <input
              type="date"
              name="to"
              defaultValue={toDate ?? ""}
              className="border rounded-md px-2 py-2 bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">Location</label>
            <select
              name="location"
              defaultValue={loc ?? ""}
              className="border rounded-md px-2 py-2 bg-background min-w-[140px]"
            >
              <option value="">All</option>
              {(locations ?? []).map((l) => (
                <option key={l.id as string} value={l.id as string}>
                  {l.name as string}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">Role</label>
            <select
              name="role"
              defaultValue={role ?? ""}
              className="border rounded-md px-2 py-2 bg-background min-w-[140px]"
            >
              <option value="">All</option>
              {(roles ?? []).map((r) => (
                <option key={r.id as string} value={r.id as string}>
                  {r.name as string}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Apply
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/app/fairness">Reset</Link>
          </Button>
        </form>
      </section>

      <section className="overflow-x-auto">
        <h2 className="text-sm font-semibold mb-3">Per-employee ledger counts</h2>
        <p className="text-xs text-muted-foreground mb-2">
          Click a name to see recent raw ledger rows for that person (same date window and filters). Totals here are sums
          of event types — approximate signals, not precise workload measures.
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No fairness ledger rows in this window yet. Events appear as shifts and tasks are assigned.
          </p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-2">Pref tasks</th>
                <th className="py-2 pr-2">Avoid tasks</th>
                <th className="py-2 pr-2">Pref shifts</th>
                <th className="py-2 pr-2">Avoid shifts</th>
                <th className="py-2 pr-2">Shift pickups</th>
                <th className="py-2 pr-2">Repeat task</th>
                <th className="py-2">Repeat shift</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employeeId} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">
                    <Link
                      href={fairnessQueryHref({
                        location: loc,
                        role,
                        from: fromDate,
                        to: toDate,
                        employee: r.employeeId,
                      })}
                      className="underline-offset-2 hover:underline"
                    >
                      {r.fullName}
                    </Link>
                  </td>
                  <td className="py-2 pr-2">{r.preferredTaskAssigned}</td>
                  <td className="py-2 pr-2">
                    {r.avoidedTaskAssigned}
                    {maxAvoided >= 3 && r.avoidedTaskAssigned === maxAvoided ? (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        high
                      </Badge>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2">{r.preferredShiftAssigned}</td>
                  <td className="py-2 pr-2">{r.avoidedShiftAssigned}</td>
                  <td className="py-2 pr-2">
                    {r.voluntaryShiftPickups}
                    {maxPickup >= 3 && r.voluntaryShiftPickups === maxPickup ? (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        high
                      </Badge>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2">{r.undesirableTaskRepeated}</td>
                  <td className="py-2">{r.undesirableShiftRepeated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {employeeDrillId ? (
        <section className="overflow-x-auto border rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Ledger detail — {drillName}</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href={fairnessQueryHref({ location: loc, role, from: fromDate, to: toDate })}>
                Clear drill-down
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Newest first (capped). Summary columns above count only assignment / shift signal types; lifecycle rows such
            as <code className="font-mono text-[10px]">override_task_completed</code> appear here for traceability but
            do not change those totals. Legacy event types may still appear for older data (for example{" "}
            <code className="font-mono text-[10px]">request_for_preferred_assignment_denied</code> is no longer written
            for ordinary denials).
          </p>
          {drillRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rows in this window.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-2">Time (UTC)</th>
                  <th className="py-2 pr-2">Event</th>
                  <th className="py-2 pr-2">Category</th>
                  <th className="py-2 pr-2">Work source</th>
                  <th className="py-2 pr-2">Category (key)</th>
                  <th className="py-2 pr-2">Task text</th>
                  <th className="py-2 pr-2">Run</th>
                  <th className="py-2">Shift</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map((ev) => (
                  <tr key={ev.id} className="border-b border-border/40">
                    <td className="py-2 pr-2 whitespace-nowrap font-mono">
                      {new Date(ev.created_at).toISOString().slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-2 pr-2 font-mono">{ev.event_type}</td>
                    <td className="py-2 pr-2">{ev.fairness_category}</td>
                    <td className="py-2 pr-2">{ledgerTaskWorkSource(ev)}</td>
                    <td className="py-2 pr-2">
                      {ev.preference_key ? (
                        <>
                          <span className="font-medium">
                            {getTaskKeyDisplayLabel(ev.preference_key, taxonomy)}
                          </span>
                          {getTaskKeyDisplayLabel(ev.preference_key, taxonomy) !== ev.preference_key ? (
                            <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">
                              {ev.preference_key}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-2 max-w-[200px] truncate" title={String(ev.metadata?.task_text_snapshot ?? "")}>
                      {typeof ev.metadata?.task_text_snapshot === "string"
                        ? ev.metadata.task_text_snapshot.slice(0, 80) +
                          (ev.metadata.task_text_snapshot.length > 80 ? "…" : "")
                        : "—"}
                    </td>
                    <td className="py-2 pr-2 font-mono text-[10px]">
                      {ev.shift_checklist_run_id ?? "—"}
                    </td>
                    <td className="py-2 font-mono text-[10px]">{ev.employee_shift_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Ranking helpers in <code className="font-mono">lib/helphub/fairness/recommendation.ts</code> are not wired into
        assignment; they are advisory only for optional future UI.
      </p>
    </div>
  );
}
