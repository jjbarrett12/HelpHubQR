import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { resolveEmployeeInActiveOrg } from "@/lib/helphub/employee-context";
import {
  PreferencesEditor,
  type SchedPref,
  type TaskPref,
  type WorkPref,
} from "@/components/helphub/fairness/PreferencesEditor";

export default async function MyPreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-lg font-semibold">My preferences</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an organization above.</p>
      </div>
    );
  }

  const employeeId = await resolveEmployeeInActiveOrg(supabase, user.id, orgId);
  if (!employeeId) {
    return (
      <div className="p-6 max-w-lg space-y-2">
        <h1 className="text-lg font-semibold">My preferences</h1>
        <p className="text-sm text-muted-foreground">
          Link your account to an employee profile to edit preferences.
        </p>
        <Link href="/app/employees" className="text-sm text-primary underline">
          Employees
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
      <header className="border-b bg-card/40 px-4 py-4">
        <h1 className="text-xl font-semibold">My preferences</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Advisory only — managers see this when assigning work.{" "}
          <Link href="/app/fairness" className="text-primary underline">
            Fairness report
          </Link>{" "}
          (managers).
        </p>
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
