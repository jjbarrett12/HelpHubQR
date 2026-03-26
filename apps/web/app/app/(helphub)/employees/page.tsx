import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeeDialog } from "@/components/helphub/EmployeeDialog";
import {
  assignEmployeeRoleFormAction,
  removeEmployeeRoleFormAction,
} from "@/app/app/helphub/actions/employees";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Select or create an organization first.</p>
      </div>
    );
  }

  const [{ data: employees }, { data: locations }, { data: staffRoles }, { data: assignments }] =
    await Promise.all([
      supabase.from("employees").select("*").eq("organization_id", orgId).order("full_name"),
      supabase.from("locations").select("id, name").eq("organization_id", orgId).order("name"),
      supabase.from("staff_roles").select("id, name").eq("organization_id", orgId).order("name"),
      supabase
        .from("employee_role_assignments")
        .select("employee_id, staff_role_id")
        .eq("organization_id", orgId),
    ]);

  const roleName = new Map((staffRoles ?? []).map((r) => [r.id as string, r.name as string]));
  const byEmp = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const eid = a.employee_id as string;
    const rn = roleName.get(a.staff_role_id as string);
    if (!rn) continue;
    const cur = byEmp.get(eid) ?? [];
    cur.push(rn);
    byEmp.set(eid, cur);
  }

  return (
    <div className="min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">People who receive shift checklist links.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/roles">Manage roles</Link>
          </Button>
          <EmployeeDialog
            locations={(locations ?? []) as { id: string; name: string }[]}
            staffRoles={(staffRoles ?? []) as { id: string; name: string }[]}
            trigger={<Button size="sm">Add employee</Button>}
          />
        </div>
      </header>
      <div className="p-6 overflow-x-auto">
        {(staffRoles ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">
            Create at least one role before adding employees.{" "}
            <Link href="/app/roles" className="underline">
              Go to roles
            </Link>
            .
          </p>
        ) : null}
        {(employees ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No employees yet. Add your first team member.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Phone</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Roles</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(employees ?? []).map((e) => (
                <tr key={e.id as string} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium">{e.full_name as string}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{(e.phone as string | null) ?? "—"}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{(e.email as string | null) ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {(byEmp.get(e.id as string) ?? []).map((n) => (
                        <Badge key={n} variant="secondary">
                          {n}
                        </Badge>
                      ))}
                      {(byEmp.get(e.id as string) ?? []).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {e.is_active ? (
                      <Badge variant="outline">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </td>
                  <td className="py-3 flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/app/employees/${e.id as string}/preferences`}>Preferences</Link>
                    </Button>
                    <EmployeeDialog
                      locations={(locations ?? []) as { id: string; name: string }[]}
                      staffRoles={(staffRoles ?? []) as { id: string; name: string }[]}
                      employee={{
                        id: e.id as string,
                        full_name: e.full_name as string,
                        phone: (e.phone as string | null) ?? null,
                        email: (e.email as string | null) ?? null,
                        location_id: (e.location_id as string | null) ?? null,
                        is_active: Boolean(e.is_active),
                      }}
                      trigger={<Button variant="ghost" size="sm">Edit</Button>}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="px-6 pb-8 text-xs text-muted-foreground space-y-2">
        <p>To assign additional roles, use quick actions below (per employee × role).</p>
        <RoleQuickForms
          employees={(employees ?? []) as { id: string; full_name: string }[]}
          staffRoles={(staffRoles ?? []) as { id: string; name: string }[]}
          assignments={(assignments ?? []) as { employee_id: string; staff_role_id: string }[]}
        />
      </div>
    </div>
  );
}

function RoleQuickForms({
  employees,
  staffRoles,
  assignments,
}: {
  employees: { id: string; full_name: string }[];
  staffRoles: { id: string; name: string }[];
  assignments: { employee_id: string; staff_role_id: string }[];
}) {
  if (employees.length === 0 || staffRoles.length === 0) return null;
  const assignedSet = new Set(assignments.map((a) => `${a.employee_id}:${a.staff_role_id}`));

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {employees.flatMap((emp) =>
        staffRoles.map((role) => {
          const has = assignedSet.has(`${emp.id}:${role.id}`);
          return (
            <form
              key={`${emp.id}-${role.id}`}
              action={has ? removeEmployeeRoleFormAction : assignEmployeeRoleFormAction}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5"
            >
              <input type="hidden" name="employee_id" value={emp.id} />
              <input type="hidden" name="staff_role_id" value={role.id} />
              <span className="truncate text-foreground">
                {emp.full_name} · {role.name}
              </span>
              <Button type="submit" size="sm" variant={has ? "secondary" : "default"}>
                {has ? "Remove" : "Assign"}
              </Button>
            </form>
          );
        })
      )}
    </div>
  );
}
