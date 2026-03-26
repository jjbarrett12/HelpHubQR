import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModulePlaceholder } from "@/components/manager-shell/ModulePlaceholder";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  return (
    <ModulePlaceholder
      kicker="People"
      title="Team"
      description="Roster, roles, and locations that define who can work which shift—not a full HRIS."
      body="This module will consolidate manager-facing people context: who’s active, what role they hold, and where they’re assigned. Preferences and fairness signals stay linked to task keys elsewhere."
      nextSteps={[
        { label: "Employees", href: "/app/employees" },
        { label: "Roles", href: "/app/roles" },
        { label: "Locations", href: "/app/locations" },
      ]}
      dataHookNote="employees, staff_roles, locations, organization_members; optional employee_task_preferences for drill-through."
    />
  );
}
