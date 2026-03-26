import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";
import {
  upsertStaffRoleFormAction,
  deleteStaffRoleFormAction,
} from "@/app/app/helphub/actions/roles";

export default async function RolesPage() {
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

  const { data: roles } = await supabase.from("staff_roles").select("*").eq("organization_id", orgId).order("name");

  return (
    <div className="min-h-full">
      <header className="border-b border-border/50 px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">Server, cook, housekeeper, picker — used on checklists and shifts.</p>
      </header>
      <div className="p-6 max-w-xl space-y-6">
        <form action={upsertStaffRoleFormAction} className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-sm font-medium" htmlFor="name">
              New role name
            </label>
            <input
              id="name"
              name="name"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g. Server"
            />
          </div>
          <Button type="submit">Add role</Button>
        </form>

        {(roles ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles yet. Add your first role above.</p>
        ) : (
          <ul className="space-y-2">
            {(roles ?? []).map((r) => (
              <li
                key={r.id as string}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3"
              >
                <form action={upsertStaffRoleFormAction} className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                  <input type="hidden" name="id" value={r.id as string} />
                  <input
                    name="name"
                    defaultValue={r.name as string}
                    className="flex-1 min-w-[160px] rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                  <Button type="submit" size="sm" variant="secondary">
                    Save
                  </Button>
                </form>
                <form action={deleteStaffRoleFormAction}>
                  <input type="hidden" name="id" value={r.id as string} />
                  <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                    Delete
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
