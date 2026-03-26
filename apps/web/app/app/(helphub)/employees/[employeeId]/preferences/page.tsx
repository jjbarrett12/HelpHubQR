import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { resolveEmployeeInActiveOrg } from "@/lib/helphub/employee-context";
import { userCanManageOrganization } from "@/lib/helphub/require-org";
import {
  PreferencesEditor,
  type SchedPref,
  type TaskPref,
  type WorkPref,
} from "@/components/helphub/fairness/PreferencesEditor";

export default async function EmployeePreferencesPage({
  params,
}: {
  params: { employeeId: string };
}) {
  const { employeeId } = params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Select an organization first.</p>
      </div>
    );
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("id", employeeId)
    .eq("organization_id", orgId)
    .single();
  if (!emp) notFound();

  const canManage = await userCanManageOrganization(supabase, user.id, orgId);
  const self = await resolveEmployeeInActiveOrg(supabase, user.id, orgId);
  if (!canManage && self !== employeeId) {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-lg font-semibold">Preferences</h1>
        <p className="text-sm text-muted-foreground mt-2">You can only edit your own preferences here.</p>
        <Link href="/app/my-preferences" className="text-sm text-primary underline mt-2 inline-block">
          My preferences
        </Link>
      </div>
    );
  }

  const [{ data: taskPrefs }, { data: schedulePrefs }, { data: workPrefs }, { data: taxonomyRows }] =
    await Promise.all([
      supabase
        .from("employee_task_preferences")
        .select("preference_key, preference_label, preference_level")
        .eq("organization_id", orgId)
        .eq("employee_id", employeeId)
        .order("preference_key"),
      supabase
        .from("employee_schedule_preferences")
        .select("id, weekday, shift_type, preference_level")
        .eq("organization_id", orgId)
        .eq("employee_id", employeeId)
        .order("weekday", { ascending: true }),
      supabase
        .from("employee_work_preferences")
        .select(
          "wants_extra_hours, open_to_same_day_coverage, open_to_weekend_shifts, prefers_consistent_schedule, max_shifts_per_week, max_hours_per_week, notes"
        )
        .eq("organization_id", orgId)
        .eq("employee_id", employeeId)
        .maybeSingle(),
      supabase
        .from("task_taxonomy")
        .select("task_key, display_label, is_active")
        .eq("organization_id", orgId),
    ]);

  const taxonomy = (taxonomyRows ?? []) as { task_key: string; display_label: string; is_active?: boolean }[];

  return (
    <div className="min-h-full">
      <header className="border-b bg-card/40 px-4 py-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Preferences · {emp.full_name as string}</h1>
          <p className="text-sm text-muted-foreground mt-1">Advisory data for assignments and fairness.</p>
        </div>
        <Link href="/app/employees" className="text-sm text-primary underline">
          ← Employees
        </Link>
      </header>
      <PreferencesEditor
        employeeId={employeeId}
        taskPrefs={(taskPrefs ?? []) as TaskPref[]}
        schedulePrefs={(schedulePrefs ?? []) as SchedPref[]}
        workPrefs={workPrefs ? (workPrefs as WorkPref) : null}
        taxonomy={taxonomy}
      />
    </div>
  );
}
