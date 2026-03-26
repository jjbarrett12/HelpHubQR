import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";
import {
  upsertLocationFormAction,
  deleteLocationFormAction,
} from "@/app/app/helphub/actions/locations";

export default async function LocationsPage() {
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

  const { data: locations } = await supabase.from("locations").select("*").eq("organization_id", orgId).order("name");

  return (
    <div className="min-h-full">
      <header className="border-b border-border/50 px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sites or branches. Optional on checklists and shifts.</p>
      </header>
      <div className="p-6 max-w-2xl space-y-6">
        <form action={upsertLocationFormAction} className="space-y-3 rounded-md border border-border/60 p-4">
          <p className="text-sm font-medium">Add location</p>
          <div className="space-y-1">
            <label className="text-sm" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm" htmlFor="address">
              Address (optional)
            </label>
            <input id="address" name="address" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <Button type="submit">Add</Button>
        </form>

        {(locations ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No locations yet.</p>
        ) : (
          <ul className="space-y-3">
            {(locations ?? []).map((loc) => (
              <li key={loc.id as string} className="rounded-md border border-border/60 p-4 space-y-3">
                <form action={upsertLocationFormAction} className="space-y-2">
                  <input type="hidden" name="id" value={loc.id as string} />
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Name</label>
                    <input
                      name="name"
                      defaultValue={loc.name as string}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Address</label>
                    <input
                      name="address"
                      defaultValue={(loc.address as string | null) ?? ""}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
                <form action={deleteLocationFormAction}>
                  <input type="hidden" name="id" value={loc.id as string} />
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
